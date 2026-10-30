import { get } from '@/db'
import { ApiError } from '@/lib/api'
import type { AuthUser } from '@/lib/jwt'
import type { BlogPageData, BlogPageResponse } from '@/lib/blog-page'
import { estimateReadMinutes, formatDateLong } from '@/lib/blog-present'
import { FEED_PAGE_SIZES, parsePage, parsePageSize } from '@/lib/pagination'
import { renderMarkdown, renderSummaryMarkdown } from '@/lib/markdown'
import { cookieName, readCookie } from '@/server/http'
import { coverThumbnailUrl, publicBase } from '@/server/images'
import { siteName, siteOwner } from '@/server/tenant'
import { visitorIdentity } from '@/server/visitor'
import { adjacentArticles, assertArticleVisible, getArticleBySlug, listByUsername, serializeArticle, verifyUnlockToken } from './articles'
import { renderArticle } from './article-render'
import { listCategoriesPublic } from './categories'
import { getArticleTags } from './tags'
import { ensureSiteConfig, siteConfigData } from './site'
import { navigationArticles } from './navigation'
import { getPagePublic } from './pages'
import { listStaticPublic } from './static-sites'

export type BlogPageContext = { viewer: AuthUser | null; req: Request }

export function homePageData(params: URLSearchParams): Extract<BlogPageData, { kind: 'home' }> {
  const author = siteOwner()
  const cfg = siteConfigData(ensureSiteConfig(author.id))
  const categoryId = Number(params.get('categoryId')) || undefined
  const tags = [...new Set(params.getAll('tag').map((tag) => tag.trim()).filter(Boolean))]
  const keyword = params.get('q') || params.get('keyword') || undefined
  const sort = params.get('sort') === 'hot' ? 'hot' as const : undefined
  const pageSize = parsePageSize(params.get('pageSize'), 12, FEED_PAGE_SIZES)
  let page = parsePage(params.get('page'))
  const options = { pageSize, categoryId, tags, keyword, sort, titleOnly: true, pinnedFirst: true }
  let result = listByUsername(author.username, { ...options, page })
  const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
  if (page > lastPage) {
    page = lastPage
    result = listByUsername(author.username, { ...options, page })
  }
  return { kind: 'home', username: author.username, activated: cfg.activated, categoryId, tags, keyword, sort,
    page, pageSize, total: result.total, categories: listCategoriesPublic(author.username),
    list: result.list.map((article) => ({ ...article, summaryHtml: renderSummaryMarkdown(article.summary), thumbnailUrl: coverThumbnailUrl(article.coverUrl, publicBase()) })) }
}

export function archivesPageData(params: URLSearchParams): Extract<BlogPageData, { kind: 'archives' }> {
  const username = siteOwner().username
  const category = listCategoriesPublic(username).find((c) => String(c.id) === params.get('categoryId') || c.name === params.get('category'))
  const tags = params.getAll('tag').filter(Boolean)
  const unknown = !!(params.get('categoryId') || params.get('category')) && !category
  const list: ReturnType<typeof listByUsername>['list'] = []
  if (!unknown) {
    const first = listByUsername(username, { categoryId: category?.id, tags, page: 1, pageSize: 100 })
    list.push(...first.list)
    for (let page = 2; page <= Math.ceil(first.total / 100); page++) {
      list.push(...listByUsername(username, { categoryId: category?.id, tags, page, pageSize: 100 }).list)
    }
  }
  return { kind: 'archives', list, categoryName: category?.name || '', tags, filtered: !!category || !!tags.length || unknown }
}

/** Shared data loading for initial SSR and subsequent JSON navigation. No read accounting here. */
export function articlePageData(slug: string, { viewer, req }: BlogPageContext): Extract<BlogPageData, { kind: 'article' }> {
  const author = siteOwner()
  const row = getArticleBySlug(author.username, slug)
  if (!row) throw new ApiError('文章不存在', 404, 404)
  assertArticleVisible(row, viewer)
  const owner = !!viewer && (viewer.id === row.user_id || viewer.isAdmin)
  const token = readCookie(req, cookieName(`wind_unlock_${row.id}`))
  const requiresPassword = row.visibility === 'password' && !owner && !verifyUnlockToken(token, row.id, row.password_hash)
  const guest = visitorIdentity(req)
  const liked = viewer
    ? !!get('SELECT id FROM blog_likes WHERE article_id = ? AND user_id = ?', row.id, viewer.id)
    : !guest.fresh && !!get("SELECT 1 FROM blog_visitor_likes WHERE kind = 'article' AND target_id = ? AND visitor_key = ?", row.id, guest.key)
  const info = serializeArticle(row, { viewerId: viewer?.id || 0, isAdmin: !!viewer?.isAdmin, includeContent: false,
    unlockTokenValid: !requiresPassword, tags: getArticleTags([row.id]).get(row.id) || [], likedSet: liked ? new Set([row.id]) : undefined })
  // Access checks precede even a lookup in the content rendering cache.
  const rendered = requiresPassword ? null : renderArticle(row.content)
  return { kind: 'article', reader: {
    themeId: 'mizuki', username: author.username,
    article: {
      id: row.id, slug: row.slug, title: row.title, content: '', html: rendered?.html || '',
      readMinutes: rendered ? estimateReadMinutes(row.content) : 0, tags: info.tags,
      categoryId: row.category_id, categoryName: listCategoriesPublic(author.username).find((c) => c.id === row.category_id)?.name || '',
      publishedAt: info.publishedAt || info.createdAt, updatedAt: info.updatedAt,
      publishedLabel: formatDateLong(info.publishedAt || info.createdAt), viewCount: info.viewCount,
      likeCount: info.likeCount, liked, commentCount: info.commentCount, requiresPassword, userId: row.user_id,
    },
    toc: rendered?.toc || [], revision: rendered?.revision || '', countRead: !requiresPassword && row.visibility !== 'private',
    adjacent: requiresPassword ? { prev: null, next: null } : adjacentArticles(row),
    isOwner: owner, viewerId: viewer?.id || 0, isAdmin: !!viewer?.isAdmin,
  } }
}

export function customPageData(slug: string, { viewer }: BlogPageContext): Extract<BlogPageData, { kind: 'page' }> {
  const author = siteOwner()
  let page
  try { page = getPagePublic(author.username, slug) }
  catch (error) {
    const draft = viewer && (viewer.id === author.id || viewer.isAdmin)
      ? get<{ title: string; content_md: string }>('SELECT title, content_md FROM blog_pages WHERE user_id = ? AND slug = ?', author.id, slug) : undefined
    if (!draft) throw error
    page = { title: draft.title + '（草稿预览）', contentMd: draft.content_md }
  }
  return { kind: 'page', title: page.title, html: renderMarkdown(page.contentMd) }
}

export function blogPageData(href: string, context: BlogPageContext): BlogPageResponse {
  if (!href.startsWith('/') || href.startsWith('//')) throw new ApiError('无效的博客路径', 400, 400)
  const url = new URL(href, 'http://blog.local')
  let pathname: string
  try { pathname = decodeURIComponent(url.pathname) } catch { throw new ApiError('页面不存在', 404, 404) }
  let page: BlogPageData
  let label = ''
  if (pathname === '/about' || pathname === '/friends') {
    const links = navigationArticles(siteOwner().id)
    const article = pathname === '/about' ? links.about : links.friends
    if (!article) throw new ApiError('页面不存在', 404, 404)
    url.pathname = `/${encodeURIComponent(article.slug)}`
    pathname = `/${article.slug}`
  }
  if (pathname === '/') page = homePageData(url.searchParams)
  else if (pathname === '/archives') { page = archivesPageData(url.searchParams); label = '文章归档' }
  else if (pathname === '/categories') { page = { kind: 'categories', list: listCategoriesPublic(siteOwner().username) }; label = '分类' }
  else if (pathname === '/static') {
    page = { kind: 'static', list: listStaticPublic(siteOwner().username).map(({ id, title, publicPath, updatedAt }) => ({ id, title, publicPath, updatedAt })) }
    label = '静态页'
  } else if (/^\/p\/[^/]+$/.test(pathname)) {
    page = customPageData(pathname.slice(3), context); label = page.title
  } else if (/^\/[^/]+$/.test(pathname)) {
    page = articlePageData(pathname.slice(1), context); label = page.reader.article.title
  } else throw new ApiError('页面不存在', 404, 404)
  return { href: url.pathname + url.search + url.hash, title: label ? `${label}-${siteName()}` : siteName(), page }
}
