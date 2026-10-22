import { all, get, run, toBool, transaction } from '@/db'
import { ApiError } from '@/lib/api'

export const DEFAULT_CATEGORY_NAME = '默认'

export interface CategoryInfo {
  id: number
  name: string
  sortOrder: number
  articleCount: number
  isDefault: boolean
}

interface CategoryRow {
  id: number
  name: string
  sort_order: number
  is_default: number
}

/** Ensure the per-user default category exists; return its id. */
export function ensureDefaultCategory(userId: number): number {
  const existing = get<{ id: number }>(
    'SELECT id FROM blog_categories WHERE user_id = ? AND is_default = 1',
    userId,
  )
  if (existing) return existing.id
  const named = get<{ id: number }>(
    'SELECT id FROM blog_categories WHERE user_id = ? AND name = ?',
    userId,
    DEFAULT_CATEGORY_NAME,
  )
  if (named) {
    run('UPDATE blog_categories SET is_default = 1 WHERE id = ?', named.id)
    return named.id
  }
  const { lastInsertRowid } = run(
    'INSERT INTO blog_categories (user_id, name, sort_order, is_default) VALUES (?, ?, 0, 1)',
    userId,
    DEFAULT_CATEGORY_NAME,
  )
  return lastInsertRowid
}

export function listCategoriesMine(userId: number): CategoryInfo[] {
  ensureDefaultCategory(userId)
  const rows = all<CategoryRow & { article_count: number }>(
    `SELECT c.id, c.name, c.sort_order, c.is_default,
            (SELECT COUNT(*) FROM blog_articles a WHERE a.category_id = c.id AND a.user_id = c.user_id) AS article_count
     FROM blog_categories c
     WHERE c.user_id = ?
     ORDER BY c.is_default DESC, c.sort_order ASC, c.id ASC`,
    userId,
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    articleCount: Number(r.article_count) || 0,
    isDefault: toBool(r.is_default),
  }))
}

/** Public categories for a username: only categories with >=1 public article. */
export function listCategoriesPublic(username: string): CategoryInfo[] {
  const rows = all<CategoryRow & { article_count: number }>(
    `SELECT c.id, c.name, c.sort_order, c.is_default,
            (SELECT COUNT(*) FROM blog_articles a
              WHERE a.category_id = c.id AND a.visibility = 'public'
                AND a.moderation_status = 'approved') AS article_count
     FROM blog_categories c
     JOIN users u ON u.id = c.user_id
     WHERE u.username = ? COLLATE NOCASE
     ORDER BY c.is_default DESC, c.sort_order ASC, c.id ASC`,
    username,
  )
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sort_order,
      articleCount: Number(r.article_count) || 0,
      isDefault: toBool(r.is_default),
    }))
    .filter((c) => c.articleCount > 0)
}

export function createCategory(
  userId: number,
  name: string,
  sortOrder = 0,
): CategoryInfo {
  const n = (name || '').trim()
  if (!n) throw new ApiError('分类名不能为空', 1, 400)
  if (n.length > 64) throw new ApiError('分类名过长', 1, 400)
  const dup = get('SELECT id FROM blog_categories WHERE user_id = ? AND name = ?', userId, n)
  if (dup) throw new ApiError('分类已存在', 1, 400)
  const { lastInsertRowid } = run(
    'INSERT INTO blog_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, 0)',
    userId,
    n,
    Number(sortOrder) || 0,
  )
  return {
    id: lastInsertRowid,
    name: n,
    sortOrder: Number(sortOrder) || 0,
    articleCount: 0,
    isDefault: false,
  }
}

export function updateCategory(
  userId: number,
  id: number,
  opts: { name?: string; sortOrder?: number },
): CategoryInfo {
  const row = get<CategoryRow>(
    'SELECT id, name, sort_order, is_default FROM blog_categories WHERE id = ? AND user_id = ?',
    id,
    userId,
  )
  if (!row) throw new ApiError('分类不存在', 1, 404)
  let name = row.name
  if (opts.name !== undefined && opts.name.trim()) {
    const n = opts.name.trim()
    if (n.length > 64) throw new ApiError('分类名过长', 1, 400)
    const dup = get(
      'SELECT id FROM blog_categories WHERE user_id = ? AND name = ? AND id <> ?',
      userId,
      n,
      id,
    )
    if (dup) throw new ApiError('分类已存在', 1, 400)
    name = n
  }
  const sortOrder =
    opts.sortOrder !== undefined ? Number(opts.sortOrder) || 0 : row.sort_order
  run(
    "UPDATE blog_categories SET name = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?",
    name,
    sortOrder,
    id,
  )
  return {
    id,
    name,
    sortOrder,
    articleCount: 0,
    isDefault: toBool(row.is_default),
  }
}

/** Delete a category; articles move to the default category. Default cannot be deleted. */
export function deleteCategory(userId: number, id: number): void {
  return transaction(() => {
    const row = get<CategoryRow>(
      'SELECT id, name, sort_order, is_default FROM blog_categories WHERE id = ? AND user_id = ?',
      id,
      userId,
    )
    if (!row) throw new ApiError('分类不存在', 1, 404)
    if (toBool(row.is_default)) throw new ApiError('默认分类不可删除', 1, 400)
    const def = ensureDefaultCategory(userId)
    run('UPDATE blog_articles SET category_id = ? WHERE category_id = ?', def, id)
    run('DELETE FROM blog_categories WHERE id = ?', id)
  })
}

export function categoryExistsForUser(userId: number, id: number): boolean {
  return !!get(
    'SELECT id FROM blog_categories WHERE id = ? AND user_id = ?',
    id,
    userId,
  )
}
