import { boundedInt } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { all, get, run } from '@/db'

export interface TagCount {
  name: string
  count: number
}

/** Replace the tag set of an article. */
export function setArticleTags(
  userId: number,
  articleId: number,
  tags: string[],
): void {
  if (tags.length > 100) throw new ApiError('标签数量不能超过 100', 1, 400)
  run('DELETE FROM blog_article_tags WHERE article_id = ?', articleId)
  const seen = new Set<string>()
  for (const raw of tags || []) {
    const name = String(raw || '').trim().slice(0, 32)
    if (!name) continue
    const lower = name.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    let tag = get<{ id: number }>(
      'SELECT id FROM blog_tags WHERE user_id = ? AND name_lower = ?',
      userId,
      lower,
    )
    if (!tag) {
      const { lastInsertRowid } = run(
        'INSERT INTO blog_tags (user_id, name, name_lower) VALUES (?, ?, ?)',
        userId,
        name,
        lower,
      )
      tag = { id: lastInsertRowid }
    }
    run(
      'INSERT OR IGNORE INTO blog_article_tags (article_id, tag_id) VALUES (?, ?)',
      articleId,
      tag.id,
    )
  }
  // Drop orphan tags for this user
  run(
    `DELETE FROM blog_tags WHERE user_id = ? AND id NOT IN
       (SELECT DISTINCT tag_id FROM blog_article_tags)`,
    userId,
  )
}

export function getArticleTags(articleIds: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>()
  if (!articleIds.length) return map
  const placeholders = articleIds.map(() => '?').join(',')
  const rows = all<{ article_id: number; name: string }>(
    `SELECT at.article_id, t.name FROM blog_article_tags at
     JOIN blog_tags t ON t.id = at.tag_id
     WHERE at.article_id IN (${placeholders})
     ORDER BY t.name ASC`,
    ...articleIds,
  )
  for (const r of rows) {
    if (!map.has(r.article_id)) map.set(r.article_id, [])
    map.get(r.article_id)!.push(r.name)
  }
  return map
}

/** Public tag aggregation for an author (public + approved articles only). */
export function listTagsPublic(username: string, limit = 100): TagCount[] {
  return all<TagCount>(
    `SELECT t.name AS name, COUNT(at.article_id) AS count
     FROM blog_tags t
     JOIN users u ON u.id = t.user_id
     JOIN blog_article_tags at ON at.tag_id = t.id
     JOIN blog_articles a ON a.id = at.article_id
     WHERE u.username = ? COLLATE NOCASE
       AND a.visibility = 'public' AND a.moderation_status = 'approved'
     GROUP BY t.id
     ORDER BY count DESC, t.name ASC
     LIMIT ?`,
    username,
    boundedInt(limit, 100, 500),
  ).map((r) => ({ name: r.name, count: Number(r.count) || 0 }))
}
