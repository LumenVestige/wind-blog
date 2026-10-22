import { all, get, run, toBool, transaction } from '@/db'
import { ApiError } from '@/lib/api'
import { boundedInt, isoToUnix } from '@/lib/utils'
import { expandUrl } from '../images'

export interface CommentInfo {
  id: number; articleId: number; parentId: number; content: string; createdAt: number
  userId: number; likeCount: number; liked: boolean
  author: { id: number; username: string; name: string; avatar: string }
  replyToUserId: number; replyToUsername: string; replyToName: string
  replies: CommentInfo[]; status?: string
}
interface CommentRow {
  id: number; article_id: number; user_id: number; parent_id: number; content: string
  like_count: number; created_at: string; author_id: number; author_username: string
  author_name: string; author_avatar: string; status: string
}
export function getComment(id: number) { return get<CommentRow>('SELECT * FROM blog_comment_entries WHERE id = ?', id) }
function serialize(row: CommentRow, liked = false): CommentInfo {
  return { id: row.id, articleId: row.article_id, parentId: row.parent_id, content: row.content,
    createdAt: isoToUnix(row.created_at), userId: row.user_id, likeCount: row.like_count, liked,
    author: { id: row.author_id, username: row.author_username, name: row.author_name, avatar: expandUrl(row.author_avatar) },
    replyToUserId: 0, replyToUsername: '', replyToName: '', replies: [], status: row.status }
}
export function listComments(articleId: number, opts: { page?: number; pageSize?: number }, viewerId = 0, visitorKey = '') {
  const page = boundedInt(opts.page, 1, 1000000), pageSize = boundedInt(opts.pageSize, 20)
  const roots = `c.article_id = ? AND c.status = 'approved' AND (c.parent_id = 0 OR NOT EXISTS (SELECT 1 FROM blog_comment_entries p WHERE p.id = c.parent_id AND p.article_id = c.article_id AND p.status = 'approved'))`
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM blog_comment_entries c WHERE ${roots}`, articleId)?.c || 0
  const totalComments = get<{ c: number }>("SELECT COUNT(*) AS c FROM blog_comment_entries WHERE article_id = ? AND status = 'approved'", articleId)?.c || 0
  const rows = all<CommentRow>(`WITH RECURSIVE roots AS (
    SELECT c.id FROM blog_comment_entries c WHERE ${roots} ORDER BY c.created_at, c.id LIMIT ? OFFSET ?
  ), tree(id) AS (SELECT id FROM roots UNION SELECT c.id FROM blog_comment_entries c JOIN tree t ON c.parent_id = t.id WHERE c.article_id = ? AND c.status = 'approved')
  SELECT * FROM blog_comment_entries WHERE id IN (SELECT id FROM tree) ORDER BY created_at, id`, articleId, pageSize, (page - 1) * pageSize, articleId)
  const liked = new Set<number>()
  if (viewerId) for (const r of all<{ comment_id: number }>('SELECT comment_id FROM blog_comment_likes WHERE user_id = ?', viewerId)) liked.add(r.comment_id)
  const actor = viewerId ? `user:${viewerId}` : visitorKey
  if (actor) for (const r of all<{ target_id: number }>("SELECT target_id FROM blog_visitor_likes WHERE kind = 'comment' AND visitor_key = ?", actor)) liked.add(r.target_id)
  const byId = new Map(rows.map(row => [row.id, serialize(row, liked.has(row.id))]))
  const list: CommentInfo[] = []
  for (const node of byId.values()) {
    const parent = byId.get(node.parentId)
    if (parent) { node.replyToUserId = parent.author.id; node.replyToUsername = parent.author.username; node.replyToName = parent.author.name; parent.replies.push(node) }
    else list.push(node)
  }
  return { list, total, totalComments, page, pageSize }
}
function validate(articleId: number, content: string, parentId: number) {
  const body = content.trim()
  if (!body || body.length > 2000) throw new ApiError('评论需为 1–2000 字', 1, 400)
  if (!get('SELECT id FROM blog_articles WHERE id = ?', articleId)) throw new ApiError('文章不存在', 1, 404)
  let cur = parentId, depth = 0
  const visited = new Set<number>()
  while (cur) {
    const p = getComment(cur)
    if (!p || p.article_id !== articleId || p.status !== 'approved') throw new ApiError('父评论不存在或尚未审核', 1, 404)
    if (visited.has(cur) || ++depth >= 3) throw new ApiError('评论层级过深', 1, 400)
    visited.add(cur); cur = p.parent_id
  }
  return body
}
export function createComment(userId: number, articleId: number, content: string, parentId = 0): CommentInfo {
  return transaction(() => {
    const body = validate(articleId, content, parentId)
    if (parentId < 0) return createGuestComment(articleId, body, parentId, '', '', userId)
    const { lastInsertRowid } = run('INSERT INTO blog_comments (article_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)', articleId, userId, parentId, body)
    run('UPDATE blog_articles SET comment_count = comment_count + 1 WHERE id = ?', articleId)
    return serialize(getComment(lastInsertRowid)!)
  })
}
export function createGuestComment(articleId: number, content: string, parentId: number, visitorKey: string, name: string, ownerId?: number): CommentInfo {
  return transaction(() => {
    const body = validate(articleId, content, parentId)
    const displayName = name.trim()
    if (!ownerId && (!displayName || displayName.length > 40)) throw new ApiError('请填写 1–40 字昵称', 1, 400)
    const { lastInsertRowid } = run('INSERT INTO blog_guest_comments (article_id, parent_id, visitor_key, owner_id, name, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)', articleId, parentId, visitorKey, ownerId || null, displayName, body, ownerId ? 'approved' : 'pending')
    if (ownerId) run('UPDATE blog_articles SET comment_count = comment_count + 1 WHERE id = ?', articleId)
    return serialize(getComment(-lastInsertRowid)!)
  })
}
export function deleteComment(userId: number, id: number, isAdmin = false): void {
  transaction(() => {
    const row = getComment(id)
    if (!row) throw new ApiError('评论不存在', 1, 404)
    const article = get<{ user_id: number }>('SELECT user_id FROM blog_articles WHERE id = ?', row.article_id)
    if (!isAdmin && row.user_id !== userId && article?.user_id !== userId) throw new ApiError('无权删除', 1, 403)
    const subtree = all<{ id: number; status: string }>(`WITH RECURSIVE tree(id) AS (SELECT id FROM blog_comment_entries WHERE id = ? UNION SELECT c.id FROM blog_comment_entries c JOIN tree t ON c.parent_id = t.id WHERE c.article_id = ?) SELECT id, status FROM blog_comment_entries WHERE id IN (SELECT id FROM tree)`, id, row.article_id)
    for (const item of subtree) run(item.id < 0 ? 'DELETE FROM blog_guest_comments WHERE id = ?' : 'DELETE FROM blog_comments WHERE id = ?', Math.abs(item.id))
    run('UPDATE blog_articles SET comment_count = MAX(0, comment_count - ?) WHERE id = ?', subtree.filter(c => c.status === 'approved').length, row.article_id)
  })
}
export function toggleVisitorLike(kind: 'article' | 'comment', id: number, actor: string) {
  return transaction(() => {
    const table = kind === 'article' ? 'blog_articles' : id < 0 ? 'blog_guest_comments' : 'blog_comments'
    const target = Math.abs(id)
    if (!get(`SELECT id FROM ${table} WHERE id = ?`, target)) throw new ApiError('内容不存在', 1, 404)
    const exists = get('SELECT 1 FROM blog_visitor_likes WHERE kind = ? AND target_id = ? AND visitor_key = ?', kind, id, actor)
    if (exists) run('DELETE FROM blog_visitor_likes WHERE kind = ? AND target_id = ? AND visitor_key = ?', kind, id, actor)
    else run('INSERT INTO blog_visitor_likes (kind, target_id, visitor_key) VALUES (?, ?, ?)', kind, id, actor)
    run(`UPDATE ${table} SET like_count = MAX(0, like_count + ?) WHERE id = ?`, exists ? -1 : 1, target)
    return { liked: !exists, likeCount: get<{ like_count: number }>(`SELECT like_count FROM ${table} WHERE id = ?`, target)!.like_count, ...(kind === 'article' ? { articleId: id } : { commentId: id }) }
  })
}
export function likeCommentToggle(userId: number, commentId: number) {
  if (commentId < 0) return toggleVisitorLike('comment', commentId, `user:${userId}`)
  return transaction(() => {
    if (!getComment(commentId)) throw new ApiError('评论不存在', 1, 404)
    const existing = get<{ id: number }>('SELECT id FROM blog_comment_likes WHERE comment_id = ? AND user_id = ?', commentId, userId)
    if (existing) run('DELETE FROM blog_comment_likes WHERE id = ?', existing.id)
    else run('INSERT INTO blog_comment_likes (comment_id, user_id) VALUES (?, ?)', commentId, userId)
    run('UPDATE blog_comments SET like_count = MAX(0, like_count + ?) WHERE id = ?', existing ? -1 : 1, commentId)
    return { liked: !existing, likeCount: getComment(commentId)!.like_count, commentId }
  })
}
export function moderateGuestComment(id: number) {
  transaction(() => {
    const row = getComment(id)
    if (!row || id >= 0) throw new ApiError('留言不存在', 1, 404)
    if (row.parent_id && getComment(row.parent_id)?.status !== 'approved') throw new ApiError('请先审核父评论', 1, 400)
    const result = run("UPDATE blog_guest_comments SET status = 'approved' WHERE id = ? AND status = 'pending'", -id)
    if (result.changes) run('UPDATE blog_articles SET comment_count = comment_count + 1 WHERE id = ?', row.article_id)
  })
}
export function pendingComments() {
  return all<CommentRow & { article_title: string; slug: string }>(`SELECT c.*, a.title AS article_title, a.slug FROM blog_comment_entries c JOIN blog_articles a ON a.id = c.article_id WHERE c.status = 'pending' ORDER BY c.created_at, c.id`).map(r => ({ ...serialize(r), articleTitle: r.article_title, slug: r.slug }))
}
export function manageComments(userId: number, opts: { status?: string; keyword?: string; page?: number; pageSize?: number }) {
  const page = boundedInt(opts.page, 1, 1000000), pageSize = boundedInt(opts.pageSize, 20)
  const status = opts.status === 'approved' ? 'approved' : 'pending'
  const where = ['a.user_id = ?', 'c.status = ?'], params: unknown[] = [userId, status]
  if (opts.keyword?.trim()) {
    where.push('(c.content LIKE ? OR c.author_name LIKE ? OR a.title LIKE ?)')
    const keyword = `%${opts.keyword.trim()}%`; params.push(keyword, keyword, keyword)
  }
  const filter = where.join(' AND ')
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM blog_comment_entries c JOIN blog_articles a ON a.id = c.article_id WHERE ${filter}`, ...params)?.n || 0
  const rows = all<CommentRow & { article_title: string; slug: string }>(`SELECT c.*, a.title AS article_title, a.slug FROM blog_comment_entries c JOIN blog_articles a ON a.id = c.article_id WHERE ${filter} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, (page - 1) * pageSize)
  return { list: rows.map(row => ({ ...serialize(row), articleTitle: row.article_title, slug: row.slug })), total, page, pageSize }
}
export function commentBelongsToUser(id: number, userId: number): boolean { return userId > 0 && getComment(id)?.user_id === userId }
export { toBool }
