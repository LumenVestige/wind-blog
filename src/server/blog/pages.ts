import { all, get, run } from '@/db'
import { ApiError } from '@/lib/api'
import { isValidSlug, slugify, uniqueSlug } from '@/lib/slug'
import { isoToUnix } from '@/lib/utils'

export interface PageRow {
  id: number
  user_id: number
  title: string
  slug: string
  content_md: string
  image_hashes: string
  status: string
  show_in_nav: number
  nav_label: string
  nav_order: number
  created_at: string
  updated_at: string
}

export interface PageInfo {
  id: number
  title: string
  slug: string
  contentMd: string
  status: string
  showInNav: boolean
  navLabel: string
  navOrder: number
  createdAt: number
  updatedAt: number
}

function serialize(row: PageRow): PageInfo {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    contentMd: row.content_md,
    status: row.status,
    showInNav: row.show_in_nav === 1,
    navLabel: row.nav_label,
    navOrder: row.nav_order,
    createdAt: isoToUnix(row.created_at),
    updatedAt: isoToUnix(row.updated_at),
  }
}

function slugExists(userId: number, slug: string, excludeId = 0): boolean {
  return !!get(
    'SELECT id FROM blog_pages WHERE user_id = ? AND slug = ? AND id <> ?',
    userId,
    slug,
    excludeId,
  )
}

function resolveSlug(userId: number, requested: string | undefined, title: string, excludeId = 0): string {
  let base = (requested || '').trim().toLowerCase()
  if (base) {
    if (!isValidSlug(base)) base = slugify(base)
    if (slugExists(userId, base, excludeId)) base = uniqueSlug(base, (s) => slugExists(userId, s, excludeId))
    return base
  }
  return uniqueSlug(slugify(title), (s) => slugExists(userId, s, excludeId))
}

export function listPagesMine(userId: number): PageInfo[] {
  return all<PageRow>(
    'SELECT * FROM blog_pages WHERE user_id = ? ORDER BY nav_order ASC, id ASC',
    userId,
  ).map(serialize)
}

export function listPagesPublic(username: string): PageInfo[] {
  const rows = all<PageRow>(
    `SELECT p.* FROM blog_pages p JOIN users u ON u.id = p.user_id
     WHERE u.username = ? COLLATE NOCASE AND p.status = 'published' AND p.show_in_nav = 1
     ORDER BY p.nav_order ASC, p.id ASC`,
    username,
  )
  return rows.map(serialize)
}

export function getPagePublic(username: string, slug: string): PageInfo {
  const row = get<PageRow>(
    `SELECT p.* FROM blog_pages p JOIN users u ON u.id = p.user_id
     WHERE u.username = ? COLLATE NOCASE AND p.slug = ?`,
    username,
    slug,
  )
  if (!row || row.status !== 'published') throw new ApiError('页面不存在', 1, 404)
  return serialize(row)
}

export interface PageWriteReq {
  id?: number
  title?: string
  slug?: string
  contentMd?: string
  status?: string
  showInNav?: boolean
  navLabel?: string
  navOrder?: number
}

function normalizeStatus(v: unknown, fallback = 'draft'): string {
  return v === 'published' ? 'published' : v === 'draft' ? 'draft' : fallback
}

export function createPage(userId: number, req: PageWriteReq): PageInfo {
  const title = (req.title || '').trim()
  if (!title) throw new ApiError('标题不能为空', 1, 400)
  const slug = resolveSlug(userId, req.slug, title)
  const { lastInsertRowid } = run(
    `INSERT INTO blog_pages (user_id, title, slug, content_md, status, show_in_nav, nav_label, nav_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    userId,
    title,
    slug,
    req.contentMd || '',
    normalizeStatus(req.status),
    req.showInNav ? 1 : 0,
    req.navLabel || '',
    Number(req.navOrder) || 0,
  )
  return serialize(get<PageRow>('SELECT * FROM blog_pages WHERE id = ?', lastInsertRowid)!)
}

export function updatePage(userId: number, req: PageWriteReq): PageInfo {
  const id = Number(req.id)
  const row = get<PageRow>('SELECT * FROM blog_pages WHERE id = ? AND user_id = ?', id, userId)
  if (!row) throw new ApiError('页面不存在', 1, 404)
  const title = (req.title ?? row.title).trim() || row.title
  const slug = resolveSlug(userId, req.slug ?? row.slug, title, id)
  run(
    `UPDATE blog_pages SET title = ?, slug = ?, content_md = ?, status = ?, show_in_nav = ?,
       nav_label = ?, nav_order = ?, updated_at = datetime('now') WHERE id = ?`,
    title,
    slug,
    req.contentMd ?? row.content_md,
    normalizeStatus(req.status, row.status),
    (req.showInNav === undefined ? row.show_in_nav === 1 : req.showInNav) ? 1 : 0,
    req.navLabel ?? row.nav_label,
    req.navOrder === undefined ? row.nav_order : Number(req.navOrder) || 0,
    id,
  )
  return serialize(get<PageRow>('SELECT * FROM blog_pages WHERE id = ?', id)!)
}

export function deletePage(userId: number, id: number): void {
  const row = get('SELECT id FROM blog_pages WHERE id = ? AND user_id = ?', id, userId)
  if (!row) throw new ApiError('页面不存在', 1, 404)
  run('DELETE FROM blog_pages WHERE id = ?', id)
}

export function reorderPages(
  userId: number,
  items: { id: number; navOrder: number }[],
): void {
  for (const item of items) {
    run(
      'UPDATE blog_pages SET nav_order = ? WHERE id = ? AND user_id = ?',
      Number(item.navOrder) || 0,
      Number(item.id),
      userId,
    )
  }
}
