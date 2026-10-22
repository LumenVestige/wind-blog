import { ApiError, bool, getQuery, num, ok, okRaw, readJson, requireAdmin, str } from '@/lib/api'
import { all, get, run } from '@/db'
import { boundedInt, isoToUnix } from '@/lib/utils'
import {
  listArticles,
  listAuthors,
  listImageUploadRequests,
  moderate,
  overview,
  reviewImageUpload,
  toggleImageUpload,
} from '@/server/blog/admin'
import {
  getSettings,
  getUpyunClient,
  isUpyunConfigured,
  setSettings,
} from '@/lib/settings'
import { expandUrl, imageReferenced, IMAGE_REFERENCED_SQL } from '@/server/images'
import type { Handler } from './types'

const EDITABLE_SETTINGS = [
  'upyun_bucket',
  'upyun_operator',
  'upyun_password',
  'upyun_domain',
  'upyun_scheme',
  'upyun_api_host',
  'upyun_upload_dir',
  'image_upload_default_enabled',
  'plugin_download_base',
  'obsidian_publish_token',
  'agreement_title',
  'agreement_content',
  'agreement_version',
]

export const adminSettingsGetH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const all = getSettings()
  const settings: Record<string, string> = {}
  for (const k of EDITABLE_SETTINGS) settings[k] = all[k] ?? ''
  return ok({ settings, upyunConfigured: isUpyunConfigured() })
}

export const adminSettingsSetH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const body = await readJson(ctx.req)
  const input = (body.settings || body) as Record<string, unknown>
  const values: Record<string, string> = {}
  for (const k of EDITABLE_SETTINGS) {
    if (input[k] !== undefined) values[k] = str(input[k])
  }
  setSettings(values)
  return ok({ saved: Object.keys(values).length, upyunConfigured: isUpyunConfigured() })
}

export const adminOverviewH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  return ok(overview())
}

export const adminAuthorsH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const q = getQuery(ctx.req)
  return okRaw({
    data: listAuthors({
      page: num(q.get('page'), 1),
      pageSize: num(q.get('pageSize'), 20),
      keyword: str(q.get('keyword')) || undefined,
    }),
  })
}

export const adminArticlesH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const q = getQuery(ctx.req)
  return okRaw({
    data: listArticles({
      page: num(q.get('page'), 1),
      pageSize: num(q.get('pageSize'), 20),
      keyword: str(q.get('keyword')) || undefined,
      status: str(q.get('status')) || undefined,
      visibility: str(q.get('visibility')) || undefined,
    }),
  })
}

export const adminModerateH: Handler = async (ctx) => {
  const admin = await requireAdmin(ctx.req)
  const body = await readJson(ctx.req)
  return ok(moderate(num(body.id), str(body.action), str(body.note), admin.id))
}

export const adminImagesH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const q = getQuery(ctx.req)
  const mode = str(q.get('mode')) || 'all'
  const page = boundedInt(q.get('page'), 1, 1000000)
  const pageSize = boundedInt(q.get('pageSize'), 20)
  const rows = all<{
    id: number
    user_id: number
    username: string
    name: string
    object_key: string
    url: string
    content_hash: string
    purpose: string
    created_at: string
    referenced: number
  }>(
    `SELECT a.id, a.user_id, u.username, u.name, a.object_key, a.url, a.content_hash,
            a.purpose, a.created_at,
            CASE WHEN (${IMAGE_REFERENCED_SQL}) THEN 1 ELSE 0 END AS referenced
     FROM blog_image_assets a JOIN users u ON u.id = a.user_id
     WHERE a.status = 'ready' ${mode === 'cleanup' ? `AND NOT (${IMAGE_REFERENCED_SQL})` : ''}
     ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`, pageSize, (page - 1) * pageSize,
  )
  const where = `a.status = 'ready' ${mode === 'cleanup' ? `AND NOT (${IMAGE_REFERENCED_SQL})` : ''}`
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM blog_image_assets a WHERE ${where}`)?.c || 0
  const list = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    name: r.name,
    objectKey: r.object_key,
    url: expandUrl(r.url),
    contentHash: r.content_hash,
    purpose: r.purpose,
    createdAt: isoToUnix(r.created_at),
    referenced: r.referenced === 1,
  }))
  const candidateIds = mode === 'cleanup' ? all<{ id: number }>(`SELECT a.id FROM blog_image_assets a WHERE ${where} ORDER BY a.created_at DESC, a.id DESC`).map((r) => r.id) : []
  const snapshot = candidateIds.join(',')
  return okRaw({
    data: { list, total, page, pageSize, mode, candidateIds, snapshot },
  })
}

export const adminImageDeleteH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const body = await readJson(ctx.req)
  const id = num(body.id)
  const row = get<{ object_key: string; user_id: number; content_hash: string }>(
    'SELECT object_key, user_id, content_hash FROM blog_image_assets WHERE id = ?',
    id,
  )
  if (!row) throw new ApiError('图片不存在', 1, 404)
  const referenced = imageReferenced(row)
  if (referenced) throw new ApiError('图片仍被引用', 409, 409)
  if (isUpyunConfigured()) {
    try {
      await getUpyunClient().delete(row.object_key)
    } catch { throw new ApiError('远端删除失败，已保留记录供重试', 1, 502) }
  }
  run('DELETE FROM blog_image_assets WHERE id = ?', id)
  return ok({ deleted: 1 })
}

export const adminImagesDeleteBatchH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const body = await readJson(ctx.req)
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((i) => num(i)))] : []
  if (ids.length > 1000) throw new ApiError('单次删除数量不能超过 1000', 1, 400)
  const snapshot = str(body.snapshot)
  let deleted = 0
  for (const id of ids) {
    const row = get<{ object_key: string; user_id: number; content_hash: string }>(
      'SELECT object_key, user_id, content_hash FROM blog_image_assets WHERE id = ?',
      id,
    )
    if (!row) continue
    const referenced = imageReferenced(row)
    if (referenced) continue
    if (isUpyunConfigured()) {
      try {
        await getUpyunClient().delete(row.object_key)
      } catch { continue }
    }
    run('DELETE FROM blog_image_assets WHERE id = ?', id)
    deleted += 1
  }
  void snapshot
  return ok({ deleted })
}

export const adminImageUploadH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const body = await readJson(ctx.req)
  return ok(toggleImageUpload(num(body.userId), bool(body.enabled)))
}

export const adminImageUploadRequestsH: Handler = async (ctx) => {
  await requireAdmin(ctx.req)
  const q = getQuery(ctx.req)
  return okRaw({
    data: listImageUploadRequests({
      page: num(q.get('page'), 1),
      pageSize: num(q.get('pageSize'), 20),
      status: str(q.get('status')) || 'pending',
    }),
  })
}

export const adminImageUploadReviewH: Handler = async (ctx) => {
  const admin = await requireAdmin(ctx.req)
  const body = await readJson(ctx.req)
  return ok(
    reviewImageUpload(num(body.id), str(body.action), str(body.note), admin.id),
  )
}

export { isoToUnix }
