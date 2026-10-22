import { all, get, run } from '@/db'
import { getUpyunClient, isUpyunConfigured, upyunUploadDir } from '@/lib/settings'
import { sha256Hex } from '@/lib/upyun'
import { ApiError } from '@/lib/api'

export function publicBase(): string {
  return getUpyunClient().publicBaseUrl()
}

/** Expand a path-only object key to a full public URL; leave absolute URLs. */
export function expandUrl(v: string): string {
  const s = (v || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('//')) {
    return s
  }
  if (s.startsWith('/')) {
    const base = publicBase()
    return base ? base + s : s
  }
  return s
}

export function objectKeyFromUrl(u: string): string {
  const s = (u || '').trim()
  if (!s) return ''
  if (s.startsWith('/')) return s
  try {
    if (/^https?:\/\//i.test(s)) return new URL(s).pathname
  } catch {
    /* ignore */
  }
  return s
}

export function guardImage(ct: string, data: Uint8Array): { ext: string } {
  const type = (ct || '').toLowerCase().split(';')[0].trim()
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'image/svg+xml': '.svg',
  }
  const ext = map[type]
  if (!ext) throw new ApiError('不支持的图片格式', 1, 400)
  if (data.length === 0 || data.length > 10 * 1024 * 1024) throw new ApiError('图片大小需为 1 字节至 10MB', 1, 400)
  if (type === 'image/svg+xml') {
    // SVG is active content when opened directly on a CDN. Substring filters
    // cannot safely handle event attributes, entities or animation-based links.
    throw new ApiError('请将 SVG 转为 PNG 或 WebP 后上传', 1, 400)
  }
  const signature = Buffer.from(data)
  const valid = type === 'image/png' ? signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    type === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255 :
    type === 'image/gif' ? /^GIF8[79]a$/.test(signature.subarray(0, 6).toString('ascii')) :
    type === 'image/webp' ? signature.subarray(0, 4).toString('ascii') === 'RIFF' && signature.subarray(8, 12).toString('ascii') === 'WEBP' :
    signature.subarray(0, 4).equals(Buffer.from([0,0,1,0]))
  if (!valid) throw new ApiError('图片内容与声明格式不一致', 1, 400)
  return { ext }
}

export interface UploadResult {
  url: string
  hash: string
  objectKey: string
}

export async function storeBlogImage(
  userId: number,
  data: Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  if (!isUpyunConfigured()) {
    throw new ApiError('站点未配置又拍云图床', 1, 403)
  }
  const { ext } = guardImage(contentType, data)
  const hash = sha256Hex(data)
  const objectKey = `/${upyunUploadDir()}/${hash}${ext}`
  const client = getUpyunClient()
  await client.put(objectKey, data, contentType)
  run(
    `INSERT INTO blog_image_assets (user_id, object_key, url, content_hash, purpose, status)
     VALUES (?, ?, ?, ?, 'content', 'ready')
     ON CONFLICT(object_key) DO UPDATE SET url = excluded.url, content_hash = excluded.content_hash,
       updated_at = datetime('now')`,
    userId,
    objectKey,
    objectKey,
    hash,
  )
  return { url: client.publicUrl(objectKey), hash, objectKey }
}

export async function storeAvatarImage(
  _userId: number,
  data: Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  if (!isUpyunConfigured()) {
    throw new ApiError('站点未配置又拍云图床', 1, 403)
  }
  const { ext } = guardImage(contentType, data)
  const hash = sha256Hex(data)
  const objectKey = `/${upyunUploadDir()}/avatar/${hash}${ext}`
  const client = getUpyunClient()
  await client.put(objectKey, data, contentType)
  return { url: client.publicUrl(objectKey), hash, objectKey }
}

export function getImageUploadStatus(userId: number) {
  const configured = isUpyunConfigured()
  const authorized = isAuthorized(userId)
  const pending = get<{ id: number }>(
    "SELECT id FROM blog_image_upload_requests WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
    userId,
  )
  return {
    configured,
    authorized,
    enabled: configured && authorized,
    pendingRequest: !!pending,
    pendingRequestId: pending?.id || 0,
  }
}

/** Single-tenant: upload is allowed once the CDN is configured. */
export function isAuthorized(_userId: number): boolean {
  return isUpyunConfigured()
}

export interface ImagesCheckResult {
  existing: string[]
  missing: string[]
  existingHashes: string[]
  missingHashes: string[]
}

export function imagesCheck(
  userId: number,
  urls: string[],
  hashes: string[],
): ImagesCheckResult {
  const normalizedUrls = [...new Set((urls || []).map((u) => String(u).trim()).filter(Boolean))]
  const normalizedHashes = [
    ...new Set(
      (hashes || [])
        .map((h) => String(h || '').trim().toLowerCase())
        .filter((h) => h.length >= 16),
    ),
  ]
  const existing: string[] = []
  const missing: string[] = []
  for (const u of normalizedUrls) {
    const key = objectKeyFromUrl(u)
    const hit = get(
      'SELECT id FROM blog_image_assets WHERE user_id = ? AND (object_key = ? OR url = ?)',
      userId,
      key,
      u,
    )
    if (hit) existing.push(u)
    else missing.push(u)
  }
  const existingHashes: string[] = []
  const missingHashes: string[] = []
  for (const h of normalizedHashes) {
    const hit = get(
      'SELECT id FROM blog_image_assets WHERE user_id = ? AND content_hash = ?',
      userId,
      h,
    )
    if (hit) existingHashes.push(h)
    else missingHashes.push(h)
  }
  return { existing, missing, existingHashes, missingHashes }
}

/** Collect image hashes referenced by a markdown body via the asset table. */
export function imageHashesForBody(body: string): string[] {
  const keys = new Set<string>()
  const re = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)|<img[^>]+src\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const url = (m[1] || m[2] || '').trim()
    const key = objectKeyFromUrl(url)
    if (key) keys.add(key)
  }
  const hashes = new Set<string>()
  const values = [...keys]
  for (let start = 0; start < values.length; start += 500) {
    const batch = values.slice(start, start + 500)
    for (const row of all<{ content_hash: string }>(`SELECT content_hash FROM blog_image_assets
      WHERE object_key IN (${batch.map(() => '?').join(',')})`, ...batch)) {
      if (row.content_hash) hashes.add(row.content_hash)
    }
  }
  return [...hashes]
}

export function listAdminImages(userId: number) {
  return all<{
    id: number
    object_key: string
    url: string
    content_hash: string
    purpose: string
    created_at: string
    referenced: number
  }>(
    `SELECT a.id, a.object_key, a.url, a.content_hash, a.purpose, a.created_at,
            CASE WHEN (${IMAGE_REFERENCED_SQL}) THEN 1 ELSE 0 END AS referenced
     FROM blog_image_assets a
     WHERE a.user_id = ? AND a.status = 'ready'
     ORDER BY a.created_at DESC`,
    userId,
  )
}

/** Shared SQL for cleanup listing and deletion; empty hashes never match everything. */
export const IMAGE_REFERENCED_SQL = `EXISTS (
  SELECT 1 FROM blog_articles art WHERE art.user_id = a.user_id AND (
    instr(art.content, a.object_key) > 0 OR instr(art.cover_url, a.object_key) > 0 OR
    (a.content_hash <> '' AND instr(art.image_hashes, a.content_hash) > 0))
) OR EXISTS (
  SELECT 1 FROM blog_pages p WHERE p.user_id = a.user_id AND (
    instr(p.content_md, a.object_key) > 0 OR (a.content_hash <> '' AND instr(p.image_hashes, a.content_hash) > 0))
) OR EXISTS (
  SELECT 1 FROM blog_site_configs sc WHERE sc.user_id = a.user_id AND (
    instr(sc.about_md, a.object_key) > 0 OR instr(sc.home_intro_md, a.object_key) > 0 OR instr(sc.friends_md, a.object_key) > 0)
) OR EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id AND instr(u.avatar, a.object_key) > 0)`

export function imageReferenced(asset: { user_id: number; object_key: string; content_hash: string }): boolean {
  return !!get(`WITH a(user_id, object_key, content_hash) AS (VALUES (?, ?, ?))
    SELECT 1 FROM a WHERE ${IMAGE_REFERENCED_SQL}`, asset.user_id, asset.object_key, asset.content_hash)
}
