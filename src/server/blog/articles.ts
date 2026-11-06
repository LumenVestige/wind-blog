import crypto from 'node:crypto'
import { all, fromBool, get, run, toBool, transaction } from '@/db'
import { signingSecret } from '@/lib/jwt'
import type { AuthUser } from '@/lib/jwt'
import { ApiError } from '@/lib/api'
import { getSetting } from '@/lib/settings'
import { buildSummary, extractImageUrls } from '@/lib/markdown'
import { hashAccessPassword, verifyAccessPasswordAsync } from '@/lib/password'
import { isValidSlug, randomSlugSuffix, slugify, uniqueSlug } from '@/lib/slug'
import { boundedInt, isoToUnix } from '@/lib/utils'
import {
  categoryExistsForUser,
  ensureDefaultCategory,
} from './categories'
import { getArticleTags, setArticleTags } from './tags'
import { expandUrl, imageHashesForBody } from '../images'

const ARTICLE_SELECT = `
  a.id, a.user_id, a.slug, a.title, a.summary, a.content, a.cover_url, a.image_hashes,
  a.visibility, a.password_hash, a.recommend, a.sync_to_main_profile, a.category_id,
  a.view_count, a.like_count, a.moderation_status, a.moderation_note,
  a.moderated_at, a.moderated_by, a.published_at, a.pinned_at, a.pin_order,
  a.created_at, a.updated_at,
  u.id AS author_id, u.username AS author_username, u.name AS author_name, u.avatar AS author_avatar
`

const ARTICLE_LIST_SELECT = ARTICLE_SELECT.replace('a.content,', "'' AS content,")
  .replace('a.password_hash,', "'' AS password_hash,")
  .replace('a.image_hashes,', "'' AS image_hashes,")

export interface ArticleRow {
  id: number
  user_id: number
  slug: string
  title: string
  summary: string
  content: string
  cover_url: string
  image_hashes: string
  visibility: string
  password_hash: string
  recommend: number
  sync_to_main_profile: number
  category_id: number | null
  view_count: number
  like_count: number
  moderation_status: string
  moderation_note: string
  moderated_at: string | null
  moderated_by: number
  published_at: string | null
  pinned_at: string | null
  pin_order: number
  created_at: string
  updated_at: string
  author_id: number
  author_username: string
  author_name: string
  author_avatar: string
}

export interface ArticleInfo {
  id: number
  slug: string
  title: string
  summary: string
  coverUrl: string
  visibility: string
  recommend: boolean
  syncToMainProfile: boolean
  categoryId: number | null
  tags: string[]
  viewCount: number
  likeCount: number
  liked: boolean
  requiresPassword: boolean
  canSeeBody: boolean
  moderationStatus: string
  moderationNote: string
  createdAt: number
  updatedAt: number
  publishedAt: number
  isDraft: boolean
  summaryIsDefault: boolean
  pinnedAt: number
  pinOrder: number
  pinned: boolean
  userId: number
  username: string
  author: {
    id: number
    username: string
    name: string
    avatar: string
  }
  content?: string
  message?: string
  unlockToken?: string
  orgIds: number[]
  sourceSolutionId: number
  sourceProblemId: number
}

export interface ArticleQueryOpts {
  tags?: string[]
  likedSet?: Set<number>
  includeContent?: boolean
  unlockTokenValid?: boolean
  viewerId?: number
  isAdmin?: boolean
}

export function serializeArticle(
  row: ArticleRow,
  opts: ArticleQueryOpts = {},
): ArticleInfo {
  const viewerId = opts.viewerId || 0
  const isAdmin = opts.isAdmin || false
  const owner = viewerId === row.user_id
  const requiresPassword = row.visibility === 'password' && !owner && !isAdmin
  const canSeeBody =
    owner ||
    isAdmin ||
    ['public', 'unlisted'].includes(row.visibility) ||
    (row.visibility === 'password' && !!opts.unlockTokenValid)

  const editorOptions = get<{ summary_mode: string; is_draft: number }>('SELECT summary_mode, is_draft FROM blog_article_options WHERE article_id = ?', row.id)
  const out: ArticleInfo = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: canSeeBody ? row.summary : '',
    coverUrl: canSeeBody ? expandUrl(row.cover_url) : '',
    visibility: row.visibility,
    recommend: toBool(row.recommend),
    syncToMainProfile: toBool(row.sync_to_main_profile),
    categoryId: row.category_id ?? null,
    tags: opts.tags || [],
    viewCount: row.view_count,
    likeCount: row.like_count,
    liked: opts.likedSet?.has(row.id) || false,
    requiresPassword: requiresPassword && !canSeeBody,
    canSeeBody,
    moderationStatus: row.moderation_status,
    moderationNote: owner || isAdmin ? row.moderation_note : '',
    createdAt: isoToUnix(row.created_at),
    updatedAt: isoToUnix(row.updated_at),
    publishedAt: isoToUnix(row.published_at || row.created_at),
    summaryIsDefault: editorOptions ? editorOptions.summary_mode === 'auto' : row.summary === buildSummary(row.content || '', 200),
    isDraft: editorOptions?.is_draft === 1,
    pinnedAt: isoToUnix(row.pinned_at),
    pinOrder: row.pin_order,
    pinned: !!row.pinned_at,
    userId: row.author_id,
    username: row.author_username,
    author: {
      id: row.author_id,
      username: row.author_username,
      name: row.author_name,
      avatar: expandUrl(row.author_avatar),
    },
    orgIds: [],
    sourceSolutionId: 0,
    sourceProblemId: 0,
  }
  if (canSeeBody && opts.includeContent !== false) {
    out.content = row.content
  } else if (requiresPassword) {
    out.message = '请输入访问密码'
  }
  return out
}

function attachTagsAndLikes(
  rows: ArticleRow[],
  viewerId: number,
): { tags: Map<number, string[]>; liked: Set<number> } {
  const tags = getArticleTags(rows.map((r) => r.id))
  const liked = new Set<number>()
  if (viewerId && rows.length) {
    const placeholders = rows.map(() => '?').join(',')
    const likedRows = all<{ article_id: number }>(
      `SELECT article_id FROM blog_likes WHERE user_id = ? AND article_id IN (${placeholders})`,
      viewerId,
      ...rows.map((r) => r.id),
    )
    for (const l of likedRows) liked.add(l.article_id)
  }
  return { tags, liked }
}

export function getArticleById(id: number): ArticleRow | undefined {
  return get<ArticleRow>(
    `SELECT ${ARTICLE_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
    id,
  )
}

export function getArticleBySlug(
  username: string,
  slug: string,
): ArticleRow | undefined {
  return get<ArticleRow>(
    `SELECT ${ARTICLE_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id
     WHERE u.username = ? COLLATE NOCASE AND a.slug = ?`,
    username,
    slug,
  )
}

export interface AdjacentArticle {
  slug: string
  title: string
}

/**
 * 按发布时间相邻的公开文章：prev 为更早一篇，next 为更新一篇。
 * 只取访客可见的文章，避免向读者暴露私密或未审核的标题。
 */
export function adjacentArticles(row: ArticleRow): {
  prev: AdjacentArticle | null
  next: AdjacentArticle | null
} {
  const at = row.published_at || row.created_at
  const base = `SELECT a.slug, a.title FROM blog_articles a
    WHERE a.user_id = ? AND a.id != ?
      AND a.visibility IN ('public','password') AND a.moderation_status = 'approved'`
  const when = 'COALESCE(a.published_at, a.created_at)'
  const prev = get<AdjacentArticle>(
    `${base} AND (${when} < ? OR (${when} = ? AND a.id < ?))
     ORDER BY ${when} DESC, a.id DESC LIMIT 1`,
    row.user_id, row.id, at, at, row.id,
  )
  const next = get<AdjacentArticle>(
    `${base} AND (${when} > ? OR (${when} = ? AND a.id > ?))
     ORDER BY ${when} ASC, a.id ASC LIMIT 1`,
    row.user_id, row.id, at, at, row.id,
  )
  // node:sqlite rows have a null prototype. RSC can only pass plain objects
  // across the server/client boundary, so never return raw rows to the reader.
  return {
    prev: prev ? { slug: prev.slug, title: prev.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
  }
}

const RESERVED_SLUGS = new Set(['about', 'archives', 'blog', 'blog-plaza', 'categories', 'dashboard', 'friends', 'login', 'manage', 'p', 'register', 'setup', 'static', 'api'])

function slugExists(userId: number, slug: string, excludeId = 0): boolean {
  if (RESERVED_SLUGS.has(slug)) return true
  const row = get<{ id: number }>(
    'SELECT id FROM blog_articles WHERE user_id = ? AND slug = ? AND id <> ?',
    userId,
    slug,
    excludeId,
  )
  return !!row
}

/** Resolve slug for create/update; keeps existing slug on update unless explicitly changed. */
function resolveSlug(
  userId: number,
  requested: string | undefined,
  title: string,
  excludeId = 0,
): string {
  const requestedSlug = (requested || '').trim().toLowerCase()
  if (excludeId && !requestedSlug) {
    const current = get<{ slug: string }>('SELECT slug FROM blog_articles WHERE id = ?', excludeId)
    if (current?.slug) return current.slug
  }
  if (requestedSlug && isValidSlug(requestedSlug)) {
    return uniqueSlug(requestedSlug, (s) => slugExists(userId, s, excludeId))
  }
  let base = requestedSlug ? slugify(requestedSlug) : ''
  if (!base || base === 'post') base = slugify(title)
  if (!base || base === 'post') base = 'post'
  const withSuffix = `${base}-${randomSlugSuffix()}`.slice(0, 96).replace(/-+$/, '')
  return uniqueSlug(withSuffix, (s) => slugExists(userId, s, excludeId))
}

export interface WriteReq {
  title?: string
  slug?: string
  summary?: string
  content?: string
  coverUrl?: string
  visibility?: string
  password?: string
  clearPassword?: boolean
  recommend?: boolean
  syncToMainProfile?: boolean
  categoryId?: number | null
  tags?: string[]
  autoSummary?: boolean
  isDraft?: boolean
  useFirstImageAsCover?: boolean
}

function normalizeVisibility(v: unknown, fallback = 'public'): string {
  const s = String(v || '').trim()
  if (['public', 'private', 'password', 'unlisted'].includes(s)) return s
  return fallback
}

export function stripGeneratedFooter(content: string): string {
  return content.replace(/(?:[ \t]*\n)*[ \t]*---[ \t]*\n+[ \t]*本文由\s*AgentWorkFlow\s*生成[ \t]*(?:\n+)?$/u, '\n')
}

function resolveCover(coverUrl: string, content: string, useFirst: boolean): string {
  const cover = (coverUrl || '').trim()
  if (cover) return cover
  if (!useFirst) return ''
  const [first] = extractImageUrls(content)
  return first || ''
}

export function createArticle(userId: number, req: WriteReq): ArticleRow {
  return transaction(() => {
    const title = (req.title || '').trim()
    if (!title) throw new ApiError('标题不能为空', 1, 400)
    if (title.length > 200) throw new ApiError('标题过长', 1, 400)
    const content = stripGeneratedFooter(req.content || '')
    const visibility = req.isDraft ? 'private' : normalizeVisibility(req.visibility)
    let passwordHash = ''
    if (visibility === 'password') {
      const plain = req.password || ''
      if (!plain.trim()) throw new ApiError('密码文章需提供访问密码', 1, 400)
      passwordHash = hashAccessPassword(plain)
    }
    const slug = resolveSlug(userId, req.slug, title)
    const summary = req.autoSummary || req.summary === undefined ? buildSummary(content, 200) : req.summary.trim().slice(0, 200)
    const cover = resolveCover(req.coverUrl || '', content, !!req.useFirstImageAsCover)
    let categoryId: number | null = null
    if (req.categoryId && categoryExistsForUser(userId, Number(req.categoryId))) {
      categoryId = Number(req.categoryId)
    } else {
      categoryId = ensureDefaultCategory(userId)
    }
    const sync =
      visibility === 'public'
        ? req.syncToMainProfile === undefined
          ? true
          : !!req.syncToMainProfile
        : false
    const imageHashes = JSON.stringify(imageHashesForBody(content + ' ' + cover))
    const now = new Date().toISOString()
    const { lastInsertRowid } = run(
      `INSERT INTO blog_articles
        (user_id, slug, title, summary, content, cover_url, image_hashes, visibility, password_hash,
         recommend, sync_to_main_profile, category_id, moderation_status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, datetime('now'), datetime('now'))`,
      userId,
      slug,
      title,
      summary,
      content,
      cover,
      imageHashes,
      visibility,
      passwordHash,
      fromBool(!!req.recommend),
      fromBool(sync),
      categoryId,
      now,
    )
    run('INSERT INTO blog_article_options (article_id, summary_mode, is_draft) VALUES (?, ?, ?)', lastInsertRowid, req.autoSummary || req.summary === undefined ? 'auto' : 'manual', fromBool(!!req.isDraft))
    setArticleTags(userId, lastInsertRowid, req.tags || [])
    return getArticleById(lastInsertRowid)!
  })
}

export function updateArticle(
  userId: number,
  id: number,
  req: WriteReq,
  isAdmin = false,
): ArticleRow {
  return transaction(() => {
    const row = get<ArticleRow>('SELECT * FROM blog_articles WHERE id = ?', id) as
      | ArticleRow
      | undefined
    if (!row) throw new ApiError('文章不存在', 1, 404)
    if (row.user_id !== userId && !isAdmin) throw new ApiError('无权修改', 1, 403)

    const title = (req.title ?? row.title).trim()
    if (!title) throw new ApiError('标题不能为空', 1, 400)
    if (title.length > 200) throw new ApiError('标题过长', 1, 400)
    const content = stripGeneratedFooter(req.content ?? row.content)
    let visibility = req.isDraft ? 'private' : normalizeVisibility(req.visibility, row.visibility)
    // Republishing from an older editor/plugin must not put navigation pages
    // into the public feed. Draft/private changes still take effect normally.
    if (visibility === 'public' && ['about_article_id', 'friends_article_id'].some((key) => Number(getSetting(key)) === id)) visibility = 'unlisted'

    let passwordHash = row.password_hash
    if (req.clearPassword || visibility !== 'password') {
      passwordHash = ''
    }
    if (visibility === 'password' && req.password) {
      passwordHash = hashAccessPassword(req.password)
    }
    if (visibility === 'password' && !passwordHash && !req.password) {
      throw new ApiError('密码文章需提供访问密码', 1, 400)
    }

    const slug = resolveSlug(row.user_id, req.slug ?? row.slug, title, id)
    const options = get<{ summary_mode: string; is_draft: number }>('SELECT summary_mode, is_draft FROM blog_article_options WHERE article_id = ?', id)
    const auto = req.autoSummary ?? (req.summary !== undefined ? false : options ? options.summary_mode === 'auto' : row.summary === buildSummary(row.content, 200))
    const summary = auto ? buildSummary(content, 200) : req.summary !== undefined ? req.summary.trim().slice(0, 200) : row.summary
    run(`INSERT INTO blog_article_options (article_id, summary_mode, is_draft) VALUES (?, ?, ?)
      ON CONFLICT(article_id) DO UPDATE SET summary_mode = excluded.summary_mode, is_draft = excluded.is_draft`, id, auto ? 'auto' : 'manual', req.isDraft === undefined ? (req.visibility !== undefined && req.visibility !== 'private' ? 0 : options?.is_draft || 0) : fromBool(req.isDraft))
    const cover = resolveCover(
      req.coverUrl ?? row.cover_url,
      content,
      !!req.useFirstImageAsCover,
    )
    let categoryId = row.category_id
    if (req.categoryId !== undefined) {
      if (req.categoryId && categoryExistsForUser(row.user_id, Number(req.categoryId))) {
        categoryId = Number(req.categoryId)
      } else {
        categoryId = ensureDefaultCategory(row.user_id)
      }
    }
    const sync =
      visibility === 'public'
        ? req.syncToMainProfile === undefined
          ? toBool(row.sync_to_main_profile)
          : !!req.syncToMainProfile
        : false
    const imageHashes = JSON.stringify(imageHashesForBody(content + ' ' + cover))

    run(
      `UPDATE blog_articles SET
         slug = ?, title = ?, summary = ?, content = ?, cover_url = ?, image_hashes = ?,
         visibility = ?, password_hash = ?, recommend = ?, sync_to_main_profile = ?, category_id = ?,
         pinned_at = CASE WHEN ? IN ('private', 'unlisted') THEN NULL ELSE pinned_at END,
         updated_at = datetime('now')
       WHERE id = ?`,
      slug,
      title,
      summary,
      content,
      cover,
      imageHashes,
      visibility,
      passwordHash,
      req.recommend === undefined ? row.recommend : fromBool(req.recommend),
      fromBool(sync),
      categoryId,
      visibility,
      id,
    )
    if (req.tags !== undefined) setArticleTags(row.user_id, id, req.tags)
    return getArticleById(id)!
  })
}

export function deleteArticle(userId: number, id: number, isAdmin = false): void {
  const row = get<{ user_id: number }>(
    'SELECT user_id FROM blog_articles WHERE id = ?',
    id,
  )
  if (!row) throw new ApiError('文章不存在', 1, 404)
  if (row.user_id !== userId && !isAdmin) throw new ApiError('无权删除', 1, 403)
  run('DELETE FROM blog_articles WHERE id = ?', id)
}

export interface ListOptions {
  status?: string
  page?: number
  pageSize?: number
  categoryId?: number
  keyword?: string
  tag?: string
  /** 多个标签（精确匹配，需全部命中）。 */
  tags?: string[]
  pinnedFirst?: boolean
  /** latest（默认）按发布时间；hot 按阅读量。 */
  sort?: 'latest' | 'hot'
  /** 关键字只匹配标题，不匹配摘要。 */
  titleOnly?: boolean
}

export function listMine(
  userId: number,
  opts: ListOptions,
): { list: ArticleInfo[]; total: number; page: number; pageSize: number } {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const where: string[] = ['a.user_id = ?']
  const params: unknown[] = [userId]
  if (opts.status === 'draft') {
    where.push('EXISTS (SELECT 1 FROM blog_article_options o WHERE o.article_id = a.id AND o.is_draft = 1)')
  } else if (opts.status && ['public', 'private', 'password', 'unlisted'].includes(opts.status)) {
    where.push('a.visibility = ? AND NOT EXISTS (SELECT 1 FROM blog_article_options o WHERE o.article_id = a.id AND o.is_draft = 1)')
    params.push(opts.status)
  }
  if (opts.categoryId) {
    where.push('a.category_id = ?')
    params.push(Number(opts.categoryId))
  }
  if (opts.keyword) {
    where.push('(a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)')
    const k = `%${opts.keyword}%`
    params.push(k, k, k)
  }
  if (opts.tag) {
    where.push(
      `a.id IN (SELECT at.article_id FROM blog_article_tags at JOIN blog_tags t ON t.id = at.tag_id
                WHERE t.user_id = ? AND t.name LIKE ?)`,
    )
    params.push(userId, `%${opts.tag}%`)
  }
  const whereSql = where.join(' AND ')
  const total =
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM blog_articles a WHERE ${whereSql}`,
      ...params,
    )?.c || 0
  const rows = all<ArticleRow>(
    `SELECT ${ARTICLE_LIST_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id
     WHERE ${whereSql}
     ORDER BY (a.pinned_at IS NOT NULL) DESC, a.pin_order ASC, a.published_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  const { tags, liked } = attachTagsAndLikes(rows, userId)
  return {
    list: rows.map((r) =>
      serializeArticle(r, {
        tags: tags.get(r.id),
        likedSet: liked,
        viewerId: userId,
        includeContent: false,
      }),
    ),
    total,
    page,
    pageSize,
  }
}

export function listByUsername(
  username: string,
  opts: ListOptions,
  viewerId = 0,
  isAdmin = false,
): {
  list: ArticleInfo[]
  total: number
  page: number
  pageSize: number
  isOwner: boolean
} {
  const author = get<{ id: number }>(
    'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
    username,
  )
  if (!author) throw new ApiError('用户不存在', 1, 404)
  const isOwner = viewerId === author.id
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const where: string[] = ['a.user_id = ?']
  const params: unknown[] = [author.id]

  if (isOwner || isAdmin) {
    // all visibilities
  } else {
    where.push("a.visibility IN ('public','password') AND a.moderation_status = 'approved'")
  }
  if (opts.categoryId) {
    where.push('a.category_id = ?')
    params.push(Number(opts.categoryId))
  }
  if (opts.keyword) {
    const k = `%${opts.keyword}%`
    if (opts.titleOnly) {
      where.push('a.title LIKE ?')
      params.push(k)
    } else {
      where.push(isOwner || isAdmin ? '(a.title LIKE ? OR a.summary LIKE ?)' : "(a.title LIKE ? OR (a.visibility = 'public' AND a.summary LIKE ?))")
      params.push(k, k)
    }
  }
  if (opts.tag) {
    where.push(
      `a.id IN (SELECT at.article_id FROM blog_article_tags at JOIN blog_tags t ON t.id = at.tag_id
                WHERE t.user_id = ? AND t.name LIKE ?)`,
    )
    params.push(author.id, `%${opts.tag}%`)
  }
  // 多标签精确匹配，且为「与」：文章需同时带有每个标签。
  const tagFilters = [...new Set((opts.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))]
  for (const t of tagFilters) {
    where.push(
      `a.id IN (SELECT at.article_id FROM blog_article_tags at JOIN blog_tags t ON t.id = at.tag_id
                WHERE t.user_id = ? AND t.name_lower = ?)`,
    )
    params.push(author.id, t)
  }
  const activeFilter = !!(opts.categoryId || opts.keyword || opts.tag || tagFilters.length)
  const whereSql = where.join(' AND ')
  const total =
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM blog_articles a WHERE ${whereSql}`,
      ...params,
    )?.c || 0
  const order = opts.sort === 'hot'
    ? 'a.view_count DESC, a.published_at DESC, a.id DESC'
    : opts.pinnedFirst && !activeFilter
      ? '(a.pinned_at IS NOT NULL) DESC, a.pin_order ASC, a.published_at DESC, a.id DESC'
      : 'a.published_at DESC, a.id DESC'
  const rows = all<ArticleRow>(
    `SELECT ${ARTICLE_LIST_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id
     WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  const { tags, liked } = attachTagsAndLikes(rows, viewerId)
  return {
    list: rows.map((r) =>
      serializeArticle(r, {
        tags: tags.get(r.id),
        likedSet: liked,
        viewerId,
        isAdmin,
        includeContent: false,
      }),
    ),
    total,
    page,
    pageSize,
    isOwner,
  }
}

export function recommendList(
  opts: { page?: number; pageSize?: number },
  viewerId = 0,
): { list: ArticleInfo[]; total: number; page: number; pageSize: number } {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const where = `a.visibility = 'public' AND a.moderation_status = 'approved'
    AND a.recommend = 1 AND a.sync_to_main_profile = 1`
  const total =
    get<{ c: number }>(`SELECT COUNT(*) AS c FROM blog_articles a WHERE ${where}`)?.c || 0
  const rows = all<ArticleRow>(
    `SELECT ${ARTICLE_LIST_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id
     WHERE ${where} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
    pageSize,
    (page - 1) * pageSize,
  )
  const { tags, liked } = attachTagsAndLikes(rows, viewerId)
  return {
    list: rows.map((r) =>
      serializeArticle(r, { tags: tags.get(r.id), likedSet: liked, viewerId, includeContent: false }),
    ),
    total,
    page,
    pageSize,
  }
}

export function plazaList(
  opts: { page?: number; pageSize?: number; keyword?: string; sort?: string },
  viewerId = 0,
): { list: ArticleInfo[]; total: number; page: number; pageSize: number } {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const where: string[] = [
    "a.visibility = 'public'",
    "a.moderation_status = 'approved'",
    'a.sync_to_main_profile = 1',
  ]
  const params: unknown[] = []
  if (opts.keyword) {
    where.push('(a.title LIKE ? OR a.summary LIKE ?)')
    const k = `%${opts.keyword}%`
    params.push(k, k)
  }
  if (opts.sort === 'recommend') where.push('a.recommend = 1')
  const whereSql = where.join(' AND ')
  const order =
    opts.sort === 'hot'
      ? 'a.view_count DESC, a.like_count DESC, a.id DESC'
      : 'a.published_at DESC, a.id DESC'
  const total =
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM blog_articles a WHERE ${whereSql}`,
      ...params,
    )?.c || 0
  const rows = all<ArticleRow>(
    `SELECT ${ARTICLE_LIST_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id
     WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  const { tags, liked } = attachTagsAndLikes(rows, viewerId)
  return {
    list: rows.map((r) =>
      serializeArticle(r, { tags: tags.get(r.id), likedSet: liked, viewerId, includeContent: false }),
    ),
    total,
    page,
    pageSize,
  }
}

export interface PlazaAuthor {
  id: number
  username: string
  name: string
  avatar: string
  articleCount: number
  lastPublishedAt: number
  latestTitle: string
}

export function authorsList(opts: {
  page?: number
  pageSize?: number
  keyword?: string
}): { list: PlazaAuthor[]; total: number; page: number; pageSize: number } {
  const page = boundedInt(opts.page, 1, 1000000)
  const pageSize = boundedInt(opts.pageSize, 20)
  const kw = opts.keyword ? `%${opts.keyword}%` : null
  const having = `HAVING COUNT(*) > 0`
  const keywordWhere = kw ? 'AND (u.username LIKE ? OR u.name LIKE ?)' : ''
  const params: unknown[] = []
  if (kw) params.push(kw, kw)
  const rows = all<{
    id: number
    username: string
    name: string
    avatar: string
    article_count: number
    last_published: string
    latest_title: string
  }>(
    `SELECT u.id, u.username, u.name, u.avatar,
            COUNT(a.id) AS article_count,
            MAX(a.published_at) AS last_published,
            (SELECT a2.title FROM blog_articles a2
              WHERE a2.user_id = u.id AND a2.visibility = 'public' AND a2.moderation_status = 'approved' AND a2.sync_to_main_profile = 1
              ORDER BY a2.published_at DESC LIMIT 1) AS latest_title
     FROM users u JOIN blog_articles a ON a.user_id = u.id
     WHERE a.visibility = 'public' AND a.moderation_status = 'approved' AND a.sync_to_main_profile = 1
       ${keywordWhere}
     GROUP BY u.id ${having}
     ORDER BY last_published DESC
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  )
  const totalRows = all<{ c: number }>(
    `SELECT COUNT(*) AS c FROM (
       SELECT u.id FROM users u JOIN blog_articles a ON a.user_id = u.id
       WHERE a.visibility='public' AND a.moderation_status='approved' AND a.sync_to_main_profile=1
         ${keywordWhere}
       GROUP BY u.id ${having})`,
    ...params,
  )
  return {
    list: rows.map((r) => ({
      id: r.id,
      username: r.username,
      name: r.name,
      avatar: expandUrl(r.avatar),
      articleCount: Number(r.article_count) || 0,
      lastPublishedAt: isoToUnix(r.last_published),
      latestTitle: r.latest_title || '',
    })),
    total: totalRows[0]?.c || 0,
    page,
    pageSize,
  }
}

export function analytics(userId: number) {
  const totals = get<{
    total_articles: number
    total_views: number
    total_likes: number
  }>(
    `SELECT COUNT(*) AS total_articles,
            COALESCE(SUM(view_count),0) AS total_views,
            COALESCE(SUM(like_count),0) AS total_likes
     FROM blog_articles WHERE user_id = ?`,
    userId,
  )
  const top = all<{
    id: number
    slug: string
    title: string
    view_count: number
    like_count: number
    visibility: string
  }>(
    `SELECT id, slug, title, view_count, like_count, visibility
     FROM blog_articles WHERE user_id = ?
     ORDER BY view_count DESC, like_count DESC LIMIT 10`,
    userId,
  )
  return {
    totalArticles: Number(totals?.total_articles) || 0,
    totalViews: Number(totals?.total_views) || 0,
    totalLikes: Number(totals?.total_likes) || 0,
    topArticles: top.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      viewCount: t.view_count,
      likeCount: t.like_count,
      visibility: t.visibility,
    })),
  }
}

// ---------- pinned ----------

export function pinnedMine(userId: number): ArticleInfo[] {
  const rows = all<ArticleRow>(
    `SELECT ${ARTICLE_LIST_SELECT} FROM blog_articles a JOIN users u ON u.id = a.user_id
     WHERE a.user_id = ? AND a.pinned_at IS NOT NULL AND a.visibility IN ('public','password')
     ORDER BY a.pin_order ASC, a.pinned_at ASC`,
    userId,
  )
  const { tags, liked } = attachTagsAndLikes(rows, userId)
  return rows.map((r) =>
    serializeArticle(r, { tags: tags.get(r.id), likedSet: liked, viewerId: userId, includeContent: false }),
  )
}

export function pinArticle(
  userId: number,
  id: number,
  pinned: boolean,
): ArticleRow {
  const row = get<ArticleRow>('SELECT * FROM blog_articles WHERE id = ?', id)
  if (!row) throw new ApiError('文章不存在', 1, 404)
  if (row.user_id !== userId) throw new ApiError('无权操作', 1, 403)
  if (pinned && !['public', 'password'].includes(row.visibility)) throw new ApiError('只有列表中可见的文章才能置顶', 1, 400)
  if (pinned) {
    const min = get<{ m: number }>(
      'SELECT COALESCE(MIN(pin_order),0) AS m FROM blog_articles WHERE user_id = ? AND pinned_at IS NOT NULL',
      userId,
    )
    run(
      "UPDATE blog_articles SET pinned_at = COALESCE(pinned_at, datetime('now')), pin_order = ?, updated_at = datetime('now') WHERE id = ?",
      (Number(min?.m) || 0) - 1,
      id,
    )
  } else {
    run(
      'UPDATE blog_articles SET pinned_at = NULL, pin_order = 0, updated_at = datetime(\'now\') WHERE id = ?',
      id,
    )
  }
  return getArticleById(id)!
}

export function reorderPinned(userId: number, articleIds: number[]): void {
  return transaction(() => {
    const current = all<{ id: number }>(
      "SELECT id FROM blog_articles WHERE user_id = ? AND pinned_at IS NOT NULL AND visibility IN ('public','password')",
      userId,
    )
    const currentIds = new Set(current.map((c) => c.id))
    if (new Set(articleIds).size !== articleIds.length || currentIds.size !== articleIds.length || articleIds.some((id) => !currentIds.has(id))) {
      throw new ApiError('置顶集合不一致', 1, 400)
    }
    articleIds.forEach((id, idx) => {
      run('UPDATE blog_articles SET pin_order = ? WHERE id = ? AND user_id = ?', idx, id, userId)
  })
  })
}

// ---------- like / view ----------

export function likeToggle(
  userId: number,
  articleId: number,
): { liked: boolean; likeCount: number } {
  return transaction(() => {
    const art = get<{ id: number }>('SELECT id FROM blog_articles WHERE id = ?', articleId)
    if (!art) throw new ApiError('文章不存在', 1, 404)
    const existing = get<{ id: number }>(
      'SELECT id FROM blog_likes WHERE article_id = ? AND user_id = ?',
      articleId,
      userId,
    )
    let liked: boolean
    if (existing) {
      run('DELETE FROM blog_likes WHERE id = ?', existing.id)
      run('UPDATE blog_articles SET like_count = MAX(0, like_count - 1) WHERE id = ?', articleId)
      liked = false
    } else {
      run('INSERT INTO blog_likes (article_id, user_id) VALUES (?, ?)', articleId, userId)
      run('UPDATE blog_articles SET like_count = like_count + 1 WHERE id = ?', articleId)
      liked = true
    }
    const count = get<{ like_count: number }>(
      'SELECT like_count FROM blog_articles WHERE id = ?',
      articleId,
    )
    return { liked, likeCount: Number(count?.like_count) || 0 }
  })
}

/** Anonymous likes are keyed by the signed visitor cookie instead of a user id. */
export function toggleVisitorLike(
  articleId: number,
  actor: string,
): { liked: boolean; likeCount: number; articleId: number } {
  return transaction(() => {
    if (!get('SELECT id FROM blog_articles WHERE id = ?', articleId)) throw new ApiError('内容不存在', 1, 404)
    const exists = get(
      "SELECT 1 FROM blog_visitor_likes WHERE kind = 'article' AND target_id = ? AND visitor_key = ?",
      articleId,
      actor,
    )
    if (exists) run("DELETE FROM blog_visitor_likes WHERE kind = 'article' AND target_id = ? AND visitor_key = ?", articleId, actor)
    else run("INSERT INTO blog_visitor_likes (kind, target_id, visitor_key) VALUES ('article', ?, ?)", articleId, actor)
    run('UPDATE blog_articles SET like_count = MAX(0, like_count + ?) WHERE id = ?', exists ? -1 : 1, articleId)
    const count = get<{ like_count: number }>('SELECT like_count FROM blog_articles WHERE id = ?', articleId)
    return { liked: !exists, likeCount: Number(count?.like_count) || 0, articleId }
  })
}

/** Count one page view. Repeat visits are not deduplicated. */
export function recordView(articleId: number): number {
  run('UPDATE blog_articles SET view_count = view_count + 1 WHERE id = ?', articleId)
  const row = get<{ view_count: number }>(
    'SELECT view_count FROM blog_articles WHERE id = ?',
    articleId,
  )
  return Number(row?.view_count) || 0
}

// ---------- unlock token ----------

function unlockSecret(): Buffer {
  return crypto
    .createHash('sha256')
    .update(signingSecret())
    .digest()
}

const UNLOCK_TTL_MS = 2 * 60 * 60 * 1000

export function makeUnlockToken(articleId: number, passwordHash = ''): string {
  const exp = Date.now() + UNLOCK_TTL_MS
  const payload = `${articleId}:${exp}:${crypto.createHash('sha256').update(passwordHash).digest('hex')}`
  const sig = crypto
    .createHmac('sha256', unlockSecret())
    .update(payload)
    .digest('base64url')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

export function verifyUnlockToken(token: string, articleId: number, passwordHash = ''): boolean {
  if (!token || token.length > 512 || token.split('.').length !== 2) return false
  const [body, sig] = token.split('.')
  let payload: string
  try {
    payload = Buffer.from(body, 'base64url').toString('utf8')
  } catch {
    return false
  }
  const expected = crypto
    .createHmac('sha256', unlockSecret())
    .update(payload)
    .digest('base64url')
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  const [idStr, expStr, version] = payload.split(':')
  if (version !== crypto.createHash('sha256').update(passwordHash).digest('hex')) return false
  if (Number(idStr) !== articleId) return false
  return Number(expStr) > Date.now()
}

export async function unlockArticle(
  id: number,
  password: string,
): Promise<{ row: ArticleRow; unlockToken: string }> {
  const row = getArticleById(id)
  if (!row || row.moderation_status !== 'approved' || row.visibility === 'private') throw new ApiError('文章不存在', 1, 404)
  if (row.visibility !== 'password') {
    return { row, unlockToken: '' }
  }
  if (!await verifyAccessPasswordAsync(row.password_hash, password || '')) {
    throw new ApiError('访问密码错误', 1, 403)
  }
  return { row, unlockToken: makeUnlockToken(id, row.password_hash) }
}

/** One access policy used by SSR, detail APIs and comment endpoints. */
export function assertArticleVisible(row: ArticleRow, viewer: AuthUser | null): void {
  if (viewer && (viewer.id === row.user_id || viewer.isAdmin)) return
  if (!['public', 'password', 'unlisted'].includes(row.visibility) || row.moderation_status !== 'approved') {
    throw new ApiError('文章不存在', 1, 404)
  }
}

export function assertArticleReadable(row: ArticleRow, viewer: AuthUser | null, token = ''): void {
  assertArticleVisible(row, viewer)
  if (row.visibility === 'password' && viewer?.id !== row.user_id && !viewer?.isAdmin &&
      !verifyUnlockToken(token, row.id, row.password_hash)) {
    throw new ApiError('请先解锁文章', 403, 403)
  }
}
