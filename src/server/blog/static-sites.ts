import crypto from 'node:crypto'
import { unzipSync } from 'fflate'
import { all, get, run } from '@/db'
import { ApiError } from '@/lib/api'
import { isValidSlug, slugify, uniqueSlug } from '@/lib/slug'
import { isoToUnix } from '@/lib/utils'
import { getUpyunClient, isUpyunConfigured } from '@/lib/settings'
import { isAuthorized } from '../images'

const MAX_ZIP = 32 * 1024 * 1024
const MAX_FILES = 1000

export interface StaticSiteRow {
  id: number
  user_id: number
  title: string
  slug: string
  entry: string
  prefix: string
  file_count: number
  show_in_nav: number
  nav_label: string
  nav_order: number
  created_at: string
  updated_at: string
}

export interface StaticSiteInfo {
  id: number
  title: string
  slug: string
  entry: string
  fileCount: number
  showInNav: boolean
  navLabel: string
  navOrder: number
  publicPath: string
  createdAt: number
  updatedAt: number
}

function serialize(row: StaticSiteRow, username: string): StaticSiteInfo {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    entry: row.entry,
    fileCount: row.file_count,
    showInNav: row.show_in_nav === 1,
    navLabel: row.nav_label,
    navOrder: row.nav_order,
    publicPath: `/static/${row.slug}/`,
    createdAt: isoToUnix(row.created_at),
    updatedAt: isoToUnix(row.updated_at),
  }
}

function slugExists(userId: number, slug: string, excludeId = 0): boolean {
  return !!get(
    'SELECT id FROM blog_static_sites WHERE user_id = ? AND slug = ? AND id <> ?',
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

export function listStaticMine(userId: number, username: string): StaticSiteInfo[] {
  return all<StaticSiteRow>(
    'SELECT * FROM blog_static_sites WHERE user_id = ? ORDER BY nav_order ASC, id ASC',
    userId,
  ).map((r) => serialize(r, username))
}

export function listStaticPublic(username: string): StaticSiteInfo[] {
  const rows = all<StaticSiteRow>(
    `SELECT s.* FROM blog_static_sites s JOIN users u ON u.id = s.user_id
     WHERE u.username = ? COLLATE NOCASE AND s.show_in_nav = 1
     ORDER BY s.nav_order ASC, s.id ASC`,
    username,
  )
  return rows.map((r) => serialize(r, username))
}

export function updateStaticSite(
  userId: number,
  username: string,
  req: { id: number; title?: string; slug?: string; showInNav?: boolean; navLabel?: string; navOrder?: number },
): StaticSiteInfo {
  const row = get<StaticSiteRow>(
    'SELECT * FROM blog_static_sites WHERE id = ? AND user_id = ?',
    Number(req.id),
    userId,
  )
  if (!row) throw new ApiError('页面不存在', 1, 404)
  const title = (req.title ?? row.title).trim() || row.title
  const slug = resolveSlug(userId, req.slug ?? row.slug, title, row.id)
  run(
    `UPDATE blog_static_sites SET title = ?, slug = ?, show_in_nav = ?, nav_label = ?,
       nav_order = ?, updated_at = datetime('now') WHERE id = ?`,
    title,
    slug,
    (req.showInNav === undefined ? row.show_in_nav === 1 : req.showInNav) ? 1 : 0,
    req.navLabel ?? row.nav_label,
    req.navOrder === undefined ? row.nav_order : Number(req.navOrder) || 0,
    row.id,
  )
  return serialize(
    get<StaticSiteRow>('SELECT * FROM blog_static_sites WHERE id = ?', row.id)!,
    username,
  )
}

export function deleteStaticSite(userId: number, id: number): void {
  const row = get('SELECT id FROM blog_static_sites WHERE id = ? AND user_id = ?', id, userId)
  if (!row) throw new ApiError('页面不存在', 1, 404)
  run('DELETE FROM blog_static_sites WHERE id = ?', id)
}

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
}

function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return MIME[ext] || 'application/octet-stream'
}

export async function uploadStaticSite(
  userId: number,
  username: string,
  opts: {
    data: Uint8Array
    title: string
    slug?: string
    entry?: string
    showInNav?: boolean
    navLabel?: string
    id?: number
  },
): Promise<StaticSiteInfo> {
  if (!isUpyunConfigured()) throw new ApiError('站点未配置又拍云图床', 1, 403)
  if (!isAuthorized(userId)) throw new ApiError('未授权上传，请先在设置中申请', 1, 403)
  if (opts.data.length > MAX_ZIP) throw new ApiError('压缩包过大（≤32MB）', 1, 400)
  const title = (opts.title || '').trim()
  if (!title) throw new ApiError('请填写名称', 1, 400)

  // Validate declared sizes before allocation; a compressed-size limit alone
  // does not stop a ZIP bomb from exhausting the process memory.
  let count = 0
  let expandedSize = 0
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(opts.data, { filter: (file) => {
      if (file.name.endsWith('/')) return false
      validateStaticPath(file.name)
      count += 1
      expandedSize += file.compression === 0 ? Math.max(file.originalSize, file.size) : file.originalSize
      if (count > MAX_FILES || (file.originalSize > 16 * 1024 * 1024 || (file.compression === 0 && file.size > 16 * 1024 * 1024)) || expandedSize > 128 * 1024 * 1024) {
        throw new ApiError('解压后文件过大或文件数过多', 1, 400)
      }
      return true
    } })
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError('无法解压，请上传 zip', 1, 400)
  }
  let entries = Object.entries(files)
  if (!entries.length) throw new ApiError('压缩包为空', 1, 400)
  // ZIPs exported as one enclosing directory should work without a manual entry.
  const enclosing = entries[0][0].split('/')[0] + '/'
  if (entries.every(([name]) => name.startsWith(enclosing))) {
    entries = entries.map(([name, data]) => [name.slice(enclosing.length), data])
  }
  const entryName = (opts.entry || '').trim() ||
    entries.find(([name]) => name === 'index.html')?.[0] ||
    entries.find(([name]) => name.endsWith('/index.html'))?.[0] || entries[0][0]
  validateStaticPath(entryName)
  if (!entries.some(([name]) => name === entryName)) throw new ApiError('找不到入口文件', 1, 400)
  const id = Number(opts.id) || 0
  const existing = id ? get<StaticSiteRow>('SELECT * FROM blog_static_sites WHERE id = ? AND user_id = ?', id, userId) : undefined
  if (id && !existing) throw new ApiError('页面不存在', 1, 404)

  // Stage to a fresh prefix. A failed update cannot overwrite the live site's files.
  const prefix = `/blog-static/${userId}/${crypto.randomUUID()}`
  const client = getUpyunClient()
  const uploaded: string[] = []
  try {
    for (let start = 0; start < entries.length; start += 4) {
      const batch = entries.slice(start, start + 4)
      const results = await Promise.allSettled(batch.map(([name, data]) => client.put(`${prefix}/${name}`, data, contentTypeFor(name))))
      for (let index = 0; index < results.length; index++) {
        if (results[index].status === 'fulfilled') uploaded.push(`${prefix}/${batch[index][0]}`)
      }
      const failure = results.find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    }
  } catch (e) {
    for (const key of uploaded) await client.delete(key).catch(() => {})
    throw e
  }
  try {
  const showInNav = opts.showInNav ?? (existing?.show_in_nav === 1)
  const navLabel = opts.navLabel ?? existing?.nav_label ?? ''
  let savedId = id
  if (existing) {
    const result = run(`UPDATE blog_static_sites SET title = ?, entry = ?, prefix = ?, file_count = ?,
      show_in_nav = ?, nav_label = ?, updated_at = datetime('now') WHERE id = ?`,
      title, entryName, prefix, entries.length, showInNav ? 1 : 0, navLabel, id)
    if (!result.changes) throw new ApiError('页面已被删除', 1, 404)
  } else {
    savedId = run(`INSERT INTO blog_static_sites (user_id, title, slug, entry, prefix, file_count, show_in_nav, nav_label)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, userId, title, resolveSlug(userId, opts.slug, title),
      entryName, prefix, entries.length, showInNav ? 1 : 0, navLabel).lastInsertRowid
  }
  return serialize(get<StaticSiteRow>('SELECT * FROM blog_static_sites WHERE id = ?', savedId)!, username)
  } catch (e) {
    for (const key of uploaded) await client.delete(key).catch(() => {})
    throw e
  }
}

export function validateStaticPath(value: string): void {
  if (!value || value.startsWith('/') || /[\\\x00-\x1f?#%]/.test(value) ||
      value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new ApiError('非法文件路径', 1, 400)
  }
}

function isHtmlEntry(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'html' || ext === 'htm'
}

function rewriteHtmlAssetUrls(html: string, cdnDir: string): string {
  return html.replace(
    /(<(?:script|link|img|source|video|audio|iframe)\b[^>]*?\s(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,
    (full, prefix: string, quote: string, value: string) => {
      const target = value.trim()
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(target)) return full
      const [path, suffix = ''] = target.split(/([?#].*)/)
      const clean = path.replace(/^\.\//, '')
      if (!clean || clean.split('/').some((part) => part === '..')) return full
      return `${prefix}${quote}${cdnDir}${clean.split('/').map(encodeURIComponent).join('/')}${suffix}${quote}`
    },
  )
}

export async function serveStaticEntry(username: string, slug: string): Promise<Response> {
  const resolved = resolveStaticFile(username, slug, '')
  if (!isHtmlEntry(resolved.path)) return Response.redirect(resolved.url, 302)
  const upstream = await fetch(resolved.url, { cache: 'no-store' })
  if (!upstream.ok) return new Response('入口文件不可用', { status: 502 })
  const html = rewriteHtmlAssetUrls(await upstream.text(), resolved.cdnDir)
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      'content-security-policy': "frame-ancestors 'self'",
    },
  })
}

export function resolveStaticFile(
  username: string,
  slug: string,
  filePath: string,
): { url: string; contentType: string; path: string; cdnDir: string } {
  const row = get<StaticSiteRow & { username: string }>(
    `SELECT s.*, u.username FROM blog_static_sites s JOIN users u ON u.id = s.user_id
     WHERE u.username = ? COLLATE NOCASE AND s.slug = ?`,
    username,
    slug,
  )
  if (!row) throw new ApiError('页面不存在', 1, 404)
  const rel = filePath || row.entry || 'index.html'
  validateStaticPath(rel)
  if (!row.prefix) throw new ApiError('页面尚未发布', 1, 404)
  const encoded = rel.split('/').map(encodeURIComponent).join('/')
  const client = getUpyunClient()
  return {
    url: client.publicUrl(`${row.prefix}/${encoded}`),
    contentType: contentTypeFor(rel),
    path: rel,
    cdnDir: client.publicUrl(`${row.prefix}/`),
  }
}
