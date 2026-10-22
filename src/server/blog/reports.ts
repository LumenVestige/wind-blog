import { all, get, run } from '@/db'
import { ApiError } from '@/lib/api'
import { boundedInt, isoToUnix } from '@/lib/utils'

export function reportArticle(
  userId: number,
  articleId: number,
  reason: string,
): { id: number; alreadyReported: boolean } {
  const body = (reason || '').trim()
  if (!body) throw new ApiError('请填写举报原因', 1, 400)
  const art = get<{ id: number }>('SELECT id FROM blog_articles WHERE id = ?', articleId)
  if (!art) throw new ApiError('文章不存在', 1, 404)
  const existing = get<{ id: number }>(
    'SELECT id FROM blog_reports WHERE user_id = ? AND article_id = ?',
    userId,
    articleId,
  )
  if (existing) return { id: existing.id, alreadyReported: true }
  const { lastInsertRowid } = run(
    'INSERT INTO blog_reports (user_id, article_id, reason) VALUES (?, ?, ?)',
    userId,
    articleId,
    body.slice(0, 500),
  )
  return { id: lastInsertRowid, alreadyReported: false }
}

export function listReports(
  status: string,
  page: number,
  pageSize: number,
) {
  page = boundedInt(page, 1, 1000000)
  pageSize = boundedInt(pageSize, 20)
  const where: string[] = []
  const params: unknown[] = []
  if (status && status !== 'all') {
    where.push('r.status = ?')
    params.push(status)
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total =
    get<{ c: number }>(`SELECT COUNT(*) AS c FROM blog_reports r ${whereSql}`, ...params)?.c || 0
  const rows = all<{
    id: number
    created_at: string
    status: string
    reason: string
    article_id: number
    reporter_id: number
    reporter_username: string
    slug: string | null
    title: string | null
    author_user_id: number | null
    author_username: string | null
  }>(
    `SELECT r.id, r.created_at, r.status, r.reason, r.article_id,
            ru.id AS reporter_id, ru.username AS reporter_username,
            a.slug, a.title, a.user_id AS author_user_id, au.username AS author_username
     FROM blog_reports r
     JOIN users ru ON ru.id = r.user_id
     LEFT JOIN blog_articles a ON a.id = r.article_id
     LEFT JOIN users au ON au.id = a.user_id
     ${whereSql}
     ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  return {
    list: rows.map((r) => ({
      id: r.id,
      createdAt: isoToUnix(r.created_at),
      status: r.status,
      reason: r.reason,
      articleId: r.article_id,
      reporter: { userId: r.reporter_id, username: r.reporter_username },
      target: {
        exists: r.slug !== null,
        slug: r.slug || '',
        title: r.title || '',
        authorUserId: r.author_user_id || 0,
        authorUsername: r.author_username || '',
      },
    })),
    total,
    page,
    pageSize,
  }
}

export function handleReport(id: number, action: string): { id: number; status: string } {
  const row = get<{ id: number }>('SELECT id FROM blog_reports WHERE id = ?', id)
  if (!row) throw new ApiError('举报不存在', 1, 404)
  const status = action === 'dismiss' ? 'dismissed' : 'resolved'
  run('UPDATE blog_reports SET status = ? WHERE id = ?', status, id)
  return { id, status }
}
