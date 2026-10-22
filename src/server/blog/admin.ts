import { all, get, run, toBool } from '@/db'
import { ApiError } from '@/lib/api'
import { boundedInt, isoToUnix } from '@/lib/utils'
import { expandUrl } from '../images'
import { ensureSiteConfig, setImageUploadEnabled } from './site'

export function overview() {
  const activatedUsers =
    get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM blog_site_configs WHERE activated_at IS NOT NULL',
    )?.c || 0
  const totals = get<{
    total_articles: number
    total_views: number
    total_likes: number
    total_comments: number
  }>(
    `SELECT COUNT(*) AS total_articles, COALESCE(SUM(view_count),0) AS total_views,
            COALESCE(SUM(like_count),0) AS total_likes, COALESCE(SUM(comment_count),0) AS total_comments
     FROM blog_articles`,
  )
  const pendingReview =
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM blog_articles WHERE moderation_status = 'pending'",
    )?.c || 0
  const rejected =
    get<{ c: number }>(
      "SELECT COUNT(*) AS c FROM blog_articles WHERE moderation_status = 'rejected'",
    )?.c || 0
  return {
    activatedUsers: Number(activatedUsers) || 0,
    totalArticles: Number(totals?.total_articles) || 0,
    totalViews: Number(totals?.total_views) || 0,
    totalLikes: Number(totals?.total_likes) || 0,
    totalComments: Number(totals?.total_comments) || 0,
    pendingReview: Number(pendingReview) || 0,
    rejected: Number(rejected) || 0,
  }
}

export function listAuthors(opts: { page?: number; pageSize?: number; keyword?: string }) {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const kw = opts.keyword ? `%${opts.keyword}%` : null
  const keywordWhere = kw ? 'AND (u.username LIKE ? OR u.name LIKE ?)' : ''
  const params: unknown[] = []
  if (kw) params.push(kw, kw)
  const total =
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM blog_site_configs sc JOIN users u ON u.id = sc.user_id
       WHERE sc.activated_at IS NOT NULL ${keywordWhere}`,
      ...params,
    )?.c || 0
  const rows = all<Record<string, unknown>>(
    `SELECT u.id AS user_id, u.username, u.name, u.avatar,
            sc.agreement_version, sc.email_notify_enabled, sc.email_notify_strategy,
            sc.theme_id, sc.image_upload_enabled, sc.activated_at, sc.agreement_accepted_at,
            (SELECT COUNT(*) FROM blog_articles a WHERE a.user_id = u.id) AS article_count,
            (SELECT COALESCE(SUM(view_count),0) FROM blog_articles a WHERE a.user_id = u.id) AS view_count,
            (SELECT COALESCE(SUM(like_count),0) FROM blog_articles a WHERE a.user_id = u.id) AS like_count,
            (SELECT COALESCE(SUM(comment_count),0) FROM blog_articles a WHERE a.user_id = u.id) AS comment_count
     FROM blog_site_configs sc JOIN users u ON u.id = sc.user_id
     WHERE sc.activated_at IS NOT NULL ${keywordWhere}
     ORDER BY sc.activated_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  return {
    list: rows.map((r) => ({
      userId: Number(r.user_id),
      username: String(r.username),
      name: String(r.name),
      avatar: expandUrl(String(r.avatar || '')),
      agreementVersion: String(r.agreement_version || ''),
      emailNotifyEnabled: toBool(r.email_notify_enabled),
      emailNotifyStrategy: String(r.email_notify_strategy || 'off'),
      themeId: String(r.theme_id || 'mizuki'),
      imageUploadEnabled: toBool(r.image_upload_enabled),
      articleCount: Number(r.article_count) || 0,
      viewCount: Number(r.view_count) || 0,
      likeCount: Number(r.like_count) || 0,
      commentCount: Number(r.comment_count) || 0,
      activated: true,
      activatedAt: isoToUnix(r.activated_at as string),
      agreementAcceptedAt: isoToUnix(r.agreement_accepted_at as string),
    })),
    total,
    page,
    pageSize,
  }
}

export function listArticles(opts: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  visibility?: string
}) {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const where: string[] = []
  const params: unknown[] = []
  if (opts.keyword) {
    where.push('(a.title LIKE ? OR a.summary LIKE ?)')
    params.push(`%${opts.keyword}%`, `%${opts.keyword}%`)
  }
  if (opts.status) {
    where.push('a.moderation_status = ?')
    params.push(opts.status)
  }
  if (opts.visibility) {
    where.push('a.visibility = ?')
    params.push(opts.visibility)
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total =
    get<{ c: number }>(`SELECT COUNT(*) AS c FROM blog_articles a ${whereSql}`, ...params)?.c || 0
  const rows = all<Record<string, unknown>>(
    `SELECT a.id, a.slug, a.title, a.summary, a.visibility, a.recommend, a.view_count, a.like_count,
            a.comment_count, a.moderation_status, a.moderation_note, a.user_id, a.created_at, a.published_at,
            a.moderated_at, u.username, u.name AS author_name
     FROM blog_articles a JOIN users u ON u.id = a.user_id
     ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  return {
    list: rows.map((r) => ({
      id: Number(r.id),
      slug: String(r.slug),
      title: String(r.title),
      summary: String(r.summary || ''),
      visibility: String(r.visibility),
      recommend: toBool(r.recommend),
      viewCount: Number(r.view_count) || 0,
      likeCount: Number(r.like_count) || 0,
      commentCount: Number(r.comment_count) || 0,
      moderationStatus: String(r.moderation_status),
      moderationNote: String(r.moderation_note || ''),
      userId: Number(r.user_id),
      username: String(r.username),
      authorName: String(r.author_name || ''),
      createdAt: isoToUnix(r.created_at as string),
      publishedAt: isoToUnix(r.published_at as string),
      moderatedAt: isoToUnix(r.moderated_at as string),
    })),
    total,
    page,
    pageSize,
  }
}

export function moderate(id: number, action: string, note = '', adminId = 0) {
  const row = get<{ id: number; visibility: string }>(
    'SELECT id, visibility FROM blog_articles WHERE id = ?',
    id,
  )
  if (!row) throw new ApiError('文章不存在', 1, 404)
  let moderationStatus: string | null = null
  let recommend: number | null = null
  switch (action) {
    case 'approve':
      moderationStatus = 'approved'
      break
    case 'reject':
      moderationStatus = 'rejected'
      break
    case 'pending':
      moderationStatus = 'pending'
      break
    case 'feature':
      recommend = 1
      moderationStatus = 'approved'
      break
    case 'unfeature':
      recommend = 0
      break
    default:
      throw new ApiError('未知操作', 1, 400)
  }
  if (recommend === 1 && row.visibility !== 'public') {
    throw new ApiError('仅公开文章可设为精选', 1, 400)
  }
  const sets: string[] = []
  const params: unknown[] = []
  if (moderationStatus) {
    sets.push('moderation_status = ?', 'moderation_note = ?', "moderated_at = datetime('now')", 'moderated_by = ?')
    params.push(moderationStatus, note, adminId)
  }
  if (recommend !== null) {
    sets.push('recommend = ?')
    params.push(recommend)
  }
  params.push(id)
  run(`UPDATE blog_articles SET ${sets.join(', ')} WHERE id = ?`, ...params)
  const updated = get<Record<string, unknown>>(
    'SELECT id, recommend, moderation_status, moderation_note FROM blog_articles WHERE id = ?',
    id,
  )!
  return {
    id,
    recommend: toBool(updated.recommend),
    moderationStatus: String(updated.moderation_status),
    moderationNote: String(updated.moderation_note || ''),
  }
}

export function listImageUploadRequests(opts: {
  page?: number
  pageSize?: number
  status?: string
}) {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const status = opts.status || 'pending'
  const where = status && status !== 'all' ? 'WHERE r.status = ?' : ''
  const params: unknown[] = status && status !== 'all' ? [status] : []
  const total =
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM blog_image_upload_requests r ${where}`,
      ...params,
    )?.c || 0
  const rows = all<Record<string, unknown>>(
    `SELECT r.*, u.username, u.name, u.avatar FROM blog_image_upload_requests r
     JOIN users u ON u.id = r.user_id ${where}
     ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  return {
    list: rows.map((r) => ({
      id: Number(r.id),
      userId: Number(r.user_id),
      username: String(r.username),
      name: String(r.name || ''),
      avatar: expandUrl(String(r.avatar || '')),
      reason: String(r.reason || ''),
      status: String(r.status),
      createdAt: isoToUnix(r.created_at as string),
      reviewNote: String(r.review_note || ''),
      reviewerId: Number(r.reviewer_id) || 0,
      reviewedAt: isoToUnix(r.reviewed_at as string),
    })),
    total,
    page,
    pageSize,
  }
}

export function reviewImageUpload(
  id: number,
  action: string,
  note: string,
  reviewerId: number,
) {
  const row = get<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM blog_image_upload_requests WHERE id = ?',
    id,
  )
  if (!row) throw new ApiError('申请不存在', 1, 404)
  const approve = action === 'approve' || action === 'approved'
  const status = approve ? 'approved' : 'rejected'
  run(
    `UPDATE blog_image_upload_requests SET status = ?, review_note = ?, reviewer_id = ?,
       reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    status,
    note || '',
    reviewerId,
    id,
  )
  if (approve) {
    ensureSiteConfig(row.user_id)
    setImageUploadEnabled(row.user_id, true)
  }
  return { id, status, userId: row.user_id }
}

export function toggleImageUpload(userId: number, enabled: boolean) {
  const user = get<{ id: number }>('SELECT id FROM users WHERE id = ?', userId)
  if (!user) throw new ApiError('用户不存在', 1, 404)
  ensureSiteConfig(userId)
  setImageUploadEnabled(userId, enabled)
  if (enabled) {
    run(
      `UPDATE blog_image_upload_requests SET status = 'approved', reviewed_at = datetime('now')
       WHERE user_id = ? AND status = 'pending'`,
      userId,
    )
  }
  return { userId, imageUploadEnabled: enabled }
}
