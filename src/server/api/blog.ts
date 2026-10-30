import { visitorIdentity, visitorCookie, limitVisitor } from '@/server/visitor'
import { setSettings } from '@/lib/settings'
import { getSetting } from '@/lib/settings'
import { cookieName, secureCookie, readCookie } from '@/server/http'
import { rateLimit } from '@/server/rate-limit'
import {
  ApiError,
  bool,
  currentUser,
  getQuery,
  num,
  ok,
  okRaw,
  readJson,
  readForm,
  requireUser,
  str,
} from '@/lib/api'
import type { AuthUser } from '@/lib/jwt'
import { saveUpyun, upyunStatus } from '@/lib/settings'
import { getOwner } from '@/server/tenant'
import { get, run, toBool } from '@/db'
import { isoToUnix } from '@/lib/utils'
import { expandUrl } from '@/server/images'
import {
  adjacentArticles,
  createArticle,
  deleteArticle,
  getArticleById,
  getArticleBySlug,
  listByUsername,
  listMine,
  assertArticleVisible,
  assertArticleReadable,
  analytics,
  authorsList,
  likeToggle,
  pinArticle,
  pinnedMine,
  plazaList,
  recommendList,
  recordView,
  reorderPinned,
  serializeArticle,
  unlockArticle,
  updateArticle,
  verifyUnlockToken,
  type ArticleRow,
} from '@/server/blog/articles'
import {
  createCategory,
  deleteCategory,
  listCategoriesMine,
  listCategoriesPublic,
  updateCategory,
} from '@/server/blog/categories'
import { getArticleTags, listTagsPublic } from '@/server/blog/tags'
import {
  createComment, createGuestComment, getComment, toggleVisitorLike, pendingComments, moderateGuestComment,
  deleteComment,
  likeCommentToggle,
  listComments,
} from '@/server/blog/comments'
import {
  activate,
  activationStatus,
  agreementGet,
  notifyPref,
  saveThemeConfig,
  siteConfigData,
  themeStatus,
  ensureSiteConfig,
} from '@/server/blog/site'
import {
  createPage,
  deletePage,
  getPagePublic,
  listPagesMine,
  listPagesPublic,
  reorderPages,
  updatePage,
} from '@/server/blog/pages'
import {
  deleteStaticSite,
  listStaticMine,
  listStaticPublic,
  resolveStaticFile,
  updateStaticSite,
  uploadStaticSite,
} from '@/server/blog/static-sites'
import {
  handleReport,
  listReports,
  reportArticle,
} from '@/server/blog/reports'
import { getImageUploadStatus, imagesCheck, isAuthorized } from '@/server/images'
import { getPluginDownloadBase, pluginPublishToken } from '@/lib/settings'
import type { Handler } from './types'

async function viewer(ctx: { req: Request }): Promise<AuthUser | null> {
  return currentUser(ctx.req)
}

// ---------------- activation / agreement ----------------

export const activationStatusH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return ok(activationStatus(user.id))
}

export const agreementGetH: Handler = async (ctx) => {
  const user = await viewer(ctx)
  if (user) return ok(agreementGet(user.id))
  return ok({
    activated: false,
    needAgreement: true,
    title: '',
    content: '',
  })
}

export const activateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const data = activate(user.id, {
    accept: bool(body.accept),
    agreementVersion: str(body.agreementVersion) || undefined,
    emailNotifyEnabled: body.emailNotifyEnabled === undefined ? undefined : bool(body.emailNotifyEnabled),
    emailNotifyStrategy: str(body.emailNotifyStrategy) || undefined,
  })
  return ok(data)
}

export const notifyPrefH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(
    notifyPref(user.id, {
      emailNotifyEnabled: body.emailNotifyEnabled === undefined ? undefined : bool(body.emailNotifyEnabled),
      emailNotifyStrategy: str(body.emailNotifyStrategy) || undefined,
    }),
  )
}

// ---------------- image upload ----------------

export const imageUploadStatusH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return ok(getImageUploadStatus(user.id))
}

async function requireSiteOwner(req: Request): Promise<AuthUser> {
  const user = await requireUser(req)
  const owner = getOwner()
  if (!owner || (user.id !== owner.id && !user.isAdmin)) {
    throw new ApiError('只有站长可以配置图床', 1, 403)
  }
  return user
}

export const upyunGetH: Handler = async (ctx) => {
  await requireSiteOwner(ctx.req)
  return ok(upyunStatus())
}

export const upyunSaveH: Handler = async (ctx) => {
  await requireSiteOwner(ctx.req)
  const body = await readJson(ctx.req)
  const bucket = str(body.bucket).trim()
  const operator = str(body.operator).trim()
  const domain = str(body.domain).trim()
  if (!bucket || !operator || !domain) {
    throw new ApiError('存储空间、操作员和 CDN 域名都要填', 1, 400)
  }
  const current = upyunStatus()
  const password = str(body.password)
  if (!password.trim() && !current.hasPassword) {
    throw new ApiError('请填写操作员密码', 1, 400)
  }
  return ok(
    saveUpyun({
      bucket,
      operator,
      password,
      domain,
      scheme: str(body.scheme) || 'https',
      apiHost: str(body.apiHost),
      uploadDir: str(body.uploadDir) || 'blog',
    }),
  )
}

export const imageUploadApplyH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const reason = str(body.reason).trim()
  if (reason.length < 5 || reason.length > 500) {
    throw new ApiError('申请理由需 5–500 字', 1, 400)
  }
  if (isAuthorized(user.id)) {
    return ok({ id: 0, pendingRequest: false, status: 'approved', authorized: true })
  }
  const pending = get<{ id: number }>(
    "SELECT id FROM blog_image_upload_requests WHERE user_id = ? AND status = 'pending'",
    user.id,
  )
  if (pending) {
    return ok({ id: pending.id, pendingRequest: true, status: 'pending', authorized: false })
  }
  const { lastInsertRowid } = run(
    'INSERT INTO blog_image_upload_requests (user_id, reason) VALUES (?, ?)',
    user.id,
    reason,
  )
  return ok({ id: lastInsertRowid, pendingRequest: true, status: 'pending', authorized: false })
}

export const imagesCheckH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const urls = Array.isArray(body.urls) ? body.urls.map((u) => String(u)) : []
  const hashes = Array.isArray(body.hashes) ? body.hashes.map((h) => String(h)) : []
  return ok(imagesCheck(user.id, urls, hashes))
}

// ---------------- categories / tags ----------------

export const categoryMineH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return okRaw({ data: { list: listCategoriesMine(user.id) } })
}

export const categoryCreateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(createCategory(user.id, str(body.name), num(body.sortOrder)))
}

export const categoryUpdateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(
    updateCategory(user.id, num(body.id), {
      name: body.name !== undefined ? str(body.name) : undefined,
      sortOrder: body.sortOrder !== undefined ? num(body.sortOrder) : undefined,
    }),
  )
}

export const categoryDeleteH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  deleteCategory(user.id, num(body.id))
  return ok({ success: true })
}

export const categoriesPublicH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  return okRaw({ data: listCategoriesPublic(str(q.get('username'))) })
}

export const tagsPublicH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const data = listTagsPublic(str(q.get('username')), num(q.get('limit'), 100))
  return okRaw({ data })
}

// ---------------- articles ----------------

export const articleMineH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const q = getQuery(ctx.req)
  const data = listMine(user.id, {
    status: str(q.get('status')) || undefined,
    page: num(q.get('page'), 1),
    pageSize: num(q.get('pageSize'), 20),
    keyword: str(q.get('keyword')) || undefined,
  })
  return okRaw({ data })
}

export const articleAdjacentH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const row = getArticleBySlug(str(q.get('username')), str(q.get('slug')))
  if (!row) throw new ApiError('文章不存在', 1, 404)
  assertArticleVisible(row, await viewer(ctx))
  return ok(adjacentArticles(row))
}

/** Speculative reads never count a visit and only return publicly readable posts. */
export const articlePrefetchH: Handler = (ctx) => {
  const owner = getOwner()
  const row = owner ? getArticleBySlug(owner.username, str(getQuery(ctx.req).get('slug'))) : undefined
  if (!row || !['public', 'unlisted'].includes(row.visibility) || row.moderation_status !== 'approved') {
    throw new ApiError('文章不存在', 1, 404)
  }
  assertArticleVisible(row, null)
  return ok(serializeArticle(row, { tags: getArticleTags([row.id]).get(row.id) }))
}

/** Background accounting for prefetched reads; revoked or stale posts are not counted. */
export const articleViewH: Handler = async (ctx) => {
  const body = await readJson(ctx.req)
  const row = getArticleById(num(body.id))
  if (!row || !['public', 'unlisted'].includes(row.visibility) || row.moderation_status !== 'approved') {
    throw new ApiError('文章不存在', 1, 404)
  }
  assertArticleVisible(row, null)
  if (num(body.updatedAt) !== isoToUnix(row.updated_at)) throw new ApiError('文章已更新', 409, 409)
  const user = await viewer(ctx)
  return ok({
    viewCount: recordView(row.id),
    likeCount: row.like_count,
    commentCount: row.comment_count,
    liked: !!user && !!get('SELECT id FROM blog_likes WHERE article_id = ? AND user_id = ?', row.id, user.id),
  })
}

export const articleGetH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const user = await viewer(ctx)
  const id = num(q.get('id'))
  const username = str(q.get('username'))
  const slug = str(q.get('slug'))
  let row: ArticleRow | undefined
  if (id) row = getArticleById(id)
  else if (username && slug) row = getArticleBySlug(username, slug)
  if (!row) throw new ApiError('文章不存在', 1, 404)

  const owner = !!user && (user.id === row.user_id || user.isAdmin)
  assertArticleVisible(row, user)
  let unlockValid = false
  const providedPassword = str(q.get('password'))
  const unlockToken = str(q.get('unlockToken')) || articleCookie(ctx, row.id)
  if (row.visibility === 'password' && !owner) {
    if (unlockToken && verifyUnlockToken(unlockToken, row.id, row.password_hash)) unlockValid = true
    else if (providedPassword) {
      rateLimit('unlock:global', 1000)
      rateLimit('unlock:' + row.id, 30)
      try {
        await unlockArticle(row.id, providedPassword)
        unlockValid = true
      } catch {
        unlockValid = false
      }
    }
  }
  if (row.visibility === 'public' && row.moderation_status !== 'approved' && !owner) {
    throw new ApiError('文章不存在', 1, 404)
  }
  if (row.visibility !== 'private' && (['public', 'unlisted'].includes(row.visibility) || owner || unlockValid)) {
    row.view_count = recordView(row.id)
  }
  const likedSet = new Set<number>()
  if (user) {
    const liked = get(
      'SELECT id FROM blog_likes WHERE article_id = ? AND user_id = ?',
      row.id,
      user.id,
    )
    if (liked) likedSet.add(row.id)
  }
  const info = serializeArticle(row, {
    viewerId: user?.id || 0,
    isAdmin: user?.isAdmin || false,
    likedSet,
    unlockTokenValid: unlockValid,
    tags: getArticleTags([row.id]).get(row.id),
  })
  if (unlockValid) info.unlockToken = unlockToken || undefined
  return okRaw({ data: info })
}

export const articleUnlockH: Handler = async (ctx) => {
  const body = await readJson(ctx.req)
  const id = num(body.id)
  const password = str(body.password)
  rateLimit('unlock:global', 1000)
  rateLimit('unlock:' + id, 30)
  const { row, unlockToken } = await unlockArticle(id, password)
  const info = serializeArticle(row, { unlockTokenValid: true })
  info.unlockToken = unlockToken
  const res = okRaw({ data: info })
  if (unlockToken) res.headers.append('Set-Cookie',
    `${cookieName(`wind_unlock_${id}`)}=${unlockToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200${secureCookie(ctx.req)}`)
  return res
}

export const articleCreateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  if (!ensureSiteConfig(user.id).activated_at) {
    throw new ApiError('请先开通博客', 1, 403)
  }
  const body = await readJson(ctx.req)
  const row = createArticle(user.id, mapWriteReq(body))
  return okRaw({ data: serializeArticle(row, { viewerId: user.id, isAdmin: user.isAdmin }) })
}

export const articleUpdateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  if (!num(body.id)) throw new ApiError('缺少文章 id', 1, 400)
  const row = updateArticle(user.id, num(body.id), mapWriteReq(body), user.isAdmin)
  return okRaw({ data: serializeArticle(row, { viewerId: user.id, isAdmin: user.isAdmin }) })
}

export const articleDeleteH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  deleteArticle(user.id, num(body.id), user.isAdmin)
  return ok({ success: true })
}

function mapWriteReq(body: Record<string, unknown>) {
  return {
    title: body.title !== undefined ? str(body.title) : undefined,
    slug: body.slug !== undefined ? str(body.slug) : undefined,
    summary: body.summary !== undefined ? str(body.summary) : undefined,
    content: body.content !== undefined ? str(body.content) : undefined,
    coverUrl: body.coverUrl !== undefined ? str(body.coverUrl) : undefined,
    visibility: body.visibility !== undefined ? str(body.visibility) : undefined,
    password: body.password !== undefined ? str(body.password) : undefined,
    clearPassword: bool(body.clearPassword),
    recommend: body.recommend !== undefined ? bool(body.recommend) : undefined,
    syncToMainProfile:
      body.syncToMainProfile === undefined || body.syncToMainProfile === null
        ? undefined
        : bool(body.syncToMainProfile),
    categoryId: body.categoryId === undefined ? undefined : body.categoryId === null ? null : num(body.categoryId),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t)) : undefined,
    autoSummary: body.autoSummary === undefined ? undefined : bool(body.autoSummary),
    isDraft: body.isDraft === undefined ? undefined : bool(body.isDraft),
    useFirstImageAsCover: bool(body.useFirstImageAsCover),
  }
}

export const articlePinH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const row = pinArticle(user.id, num(body.id), bool(body.pinned))
  return okRaw({ data: serializeArticle(row, { viewerId: user.id, isAdmin: user.isAdmin }) })
}

export const articlePinnedMineH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return okRaw({ data: pinnedMine(user.id) })
}

export const articlePinnedReorderH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const ids = Array.isArray(body.articleIds) ? body.articleIds.map((i) => num(i)) : []
  reorderPinned(user.id, ids)
  return ok({ success: true })
}

export const byUsernameH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const username = str(q.get('username'))
  const user = await viewer(ctx)
  const res = listByUsername(
    username,
    {
      page: num(q.get('page'), 1),
      pageSize: num(q.get('pageSize'), 20),
      categoryId: num(q.get('categoryId')) || undefined,
      keyword: str(q.get('keyword')) || str(q.get('q')) || undefined,
      tag: str(q.get('tag')) || undefined,
      pinnedFirst: bool(q.get('pinnedFirst')),
    },
    user?.id || 0,
    user?.isAdmin || false,
  )
  const authorRow = get<{
    id: number
    username: string
    name: string
    avatar: string
  }>(
    'SELECT id, username, name, avatar FROM users WHERE username = ? COLLATE NOCASE',
    username,
  )!
  const cfg = ensureSiteConfig(authorRow.id)
  const cfgData = siteConfigData(cfg)
  const { expandUrl } = await import('@/server/images')
  return okRaw({
    data: {
      author: {
        id: authorRow.id,
        username: authorRow.username,
        name: authorRow.name,
        avatar: expandUrl(authorRow.avatar),
      },
      list: res.list,
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      isOwner: res.isOwner,
      activated: cfgData.activated,
      themeEnabled: cfgData.activated,
      themeId: cfgData.themeId,
      colorScheme: cfgData.colorScheme,
      subtitle: cfgData.subtitle,
      socialLinks: cfgData.socialLinks,
      aboutMd: cfgData.aboutMd,
      homeIntroMd: cfgData.homeIntroMd,
      friendsMd: cfgData.friendsMd,
    },
  })
}

export const recommendH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const user = await viewer(ctx)
  return okRaw({
    data: recommendList(
      { page: num(q.get('page'), 1), pageSize: num(q.get('pageSize'), 20) },
      user?.id || 0,
    ),
  })
}

export const plazaH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const user = await viewer(ctx)
  return okRaw({
    data: plazaList(
      {
        page: num(q.get('page'), 1),
        pageSize: num(q.get('pageSize'), 20),
        keyword: str(q.get('keyword')) || undefined,
        sort: str(q.get('sort')) || 'latest',
      },
      user?.id || 0,
    ),
  })
}

export const authorsH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  return okRaw({
    data: authorsList({
      page: num(q.get('page'), 1),
      pageSize: num(q.get('pageSize'), 20),
      keyword: str(q.get('keyword')) || undefined,
    }),
  })
}

export const analyticsH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return ok(analytics(user.id))
}

// ---------------- comments ----------------

function articleCookie(ctx: Parameters<Handler>[0], id: number): string {
  return readCookie(ctx.req, cookieName(`wind_unlock_${id}`))
}

async function readable(ctx: Parameters<Handler>[0], id: number, token = '') {
  const row = getArticleById(id)
  if (!row) throw new ApiError('文章不存在', 1, 404)
  assertArticleReadable(row, await viewer(ctx), token || articleCookie(ctx, id))
}

export const commentListH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  await readable(ctx, num(q.get('articleId')), str(q.get('unlockToken')))
  const user = await viewer(ctx)
  return okRaw({
    data: listComments(
      num(q.get('articleId')),
      { page: num(q.get('page'), 1), pageSize: num(q.get('pageSize'), 20) },
      user?.id || 0, visitorIdentity(ctx.req).fresh ? '' : visitorIdentity(ctx.req).key,
    ),
  })
}

export const commentCreateH: Handler = async (ctx) => {
  const user = await viewer(ctx)
  if (getSetting('comments_enabled', '1') !== '1') throw new ApiError('站长已关闭评论', 1, 403)
  const body = await readJson(ctx.req)
  await readable(ctx, num(body.articleId), str(body.unlockToken))
  if (user) return ok(createComment(user.id, num(body.articleId), str(body.content), num(body.parentId)))
  const identity = visitorIdentity(ctx.req)
  limitVisitor(ctx.req, identity.key, 'comment')
  const result = createGuestComment(num(body.articleId), str(body.content), num(body.parentId), identity.key, str(body.name))
  return visitorCookie(ok(result), ctx.req, identity)
}
export const commentPendingH: Handler = async (ctx) => {
  await requireSiteOwner(ctx.req)
  return ok({ list: pendingComments() })
}
export const commentApproveH: Handler = async (ctx) => {
  await requireSiteOwner(ctx.req)
  const body = await readJson(ctx.req)
  moderateGuestComment(num(body.id))
  return ok({ success: true })
}

export const commentDeleteH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  deleteComment(user.id, num(body.id), user.isAdmin)
  return ok({ success: true })
}

export const commentLikeH: Handler = async (ctx) => {
  if (getSetting('likes_enabled', '1') !== '1') throw new ApiError('站长已关闭点赞', 1, 403)
  const user = await viewer(ctx), body = await readJson(ctx.req)
  const comment = getComment(num(body.commentId))
  if (!comment || comment.status !== 'approved') throw new ApiError('评论不存在', 1, 404)
  await readable(ctx, comment.article_id, str(body.unlockToken))
  if (user) return ok(likeCommentToggle(user.id, num(body.commentId)))
  const identity = visitorIdentity(ctx.req)
  limitVisitor(ctx.req, identity.key, 'like')
  return visitorCookie(ok(toggleVisitorLike('comment', num(body.commentId), identity.key)), ctx.req, identity)
}
export const likeH: Handler = async (ctx) => {
  if (getSetting('likes_enabled', '1') !== '1') throw new ApiError('站长已关闭点赞', 1, 403)
  const user = await viewer(ctx), body = await readJson(ctx.req)
  await readable(ctx, num(body.articleId), str(body.unlockToken))
  if (user) return ok(likeToggle(user.id, num(body.articleId)))
  const identity = visitorIdentity(ctx.req)
  limitVisitor(ctx.req, identity.key, 'like')
  return visitorCookie(ok(toggleVisitorLike('article', num(body.articleId), identity.key)), ctx.req, identity)
}

// ---------------- reports ----------------

export const reportH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(reportArticle(user.id, num(body.articleId), str(body.reason)))
}

export const reportListH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  if (!user.isAdmin) throw new ApiError('无权限', 403, 403)
  const q = getQuery(ctx.req)
  return okRaw({
    data: listReports(
      str(q.get('status')) || 'pending',
      num(q.get('page'), 1),
      num(q.get('pageSize'), 20),
    ),
  })
}

export const reportHandleH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  if (!user.isAdmin) throw new ApiError('无权限', 403, 403)
  const body = await readJson(ctx.req)
  return ok(handleReport(num(body.id), str(body.action)))
}

// ---------------- theme ----------------

export const themeStatusH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  const username = str(q.get('username'))
  const user = await viewer(ctx)
  if (username) return ok(themeStatus(username))
  if (!user) throw new ApiError('缺少用户', 1, 400)
  return ok(themeStatus(undefined, user.id))
}

export const themeConfigH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(
    saveThemeConfig(user.id, {
      themeId: body.themeId !== undefined ? str(body.themeId) : undefined,
      colorScheme: body.colorScheme !== undefined ? str(body.colorScheme) : undefined,
      subtitle: body.subtitle !== undefined ? str(body.subtitle) : undefined,
      socialLinks: body.socialLinks,
      aboutMd: body.aboutMd === undefined ? undefined : (body.aboutMd as string | null),
      homeIntroMd: body.homeIntroMd === undefined ? undefined : (body.homeIntroMd as string | null),
      friendsMd: body.friendsMd === undefined ? undefined : (body.friendsMd as string | null),
    }),
  )
}

// ---------------- pages ----------------

export const pageMineH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return okRaw({ data: listPagesMine(user.id) })
}

export const pageListPublicH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  return okRaw({ data: listPagesPublic(str(q.get('username'))) })
}

export const pageGetPublicH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  return ok(getPagePublic(str(q.get('username')), str(q.get('slug'))))
}

function mapPageReq(body: Record<string, unknown>) {
  return {
    id: num(body.id),
    title: body.title === undefined ? undefined : str(body.title),
    slug: body.slug === undefined ? undefined : str(body.slug),
    contentMd: body.contentMd === undefined ? undefined : str(body.contentMd),
    status: body.status === undefined ? undefined : str(body.status),
    showInNav: body.showInNav === undefined ? undefined : bool(body.showInNav),
    navLabel: body.navLabel === undefined ? undefined : str(body.navLabel),
    navOrder: body.navOrder === undefined ? undefined : num(body.navOrder),
  }
}

export const pageCreateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(createPage(user.id, mapPageReq(body)))
}

export const pageUpdateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(updatePage(user.id, mapPageReq(body)))
}

export const pageDeleteH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  deletePage(user.id, num(body.id))
  return ok({ success: true })
}

export const pageReorderH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const items = Array.isArray(body.items)
    ? body.items.map((i) => {
        const o = i as Record<string, unknown>
        return { id: num(o.id), navOrder: num(o.navOrder) }
      })
    : []
  reorderPages(user.id, items)
  return ok({ success: true })
}

// ---------------- static sites ----------------

export const staticSiteListPublicH: Handler = async (ctx) => {
  const q = getQuery(ctx.req)
  return okRaw({ data: listStaticPublic(str(q.get('username'))) })
}

export const staticSiteMineH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  return okRaw({ data: listStaticMine(user.id, user.username) })
}

export const staticSiteUploadH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const form = await readForm(ctx.req, 33 * 1024 * 1024)
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError('缺少文件', 1, 400)
  const data = new Uint8Array(await file.arrayBuffer())
  const res = await uploadStaticSite(user.id, user.username, {
    data,
    title: str(form.get('title')),
    slug: str(form.get('slug')) || undefined,
    entry: str(form.get('entry')) || undefined,
    showInNav: form.has('showInNav') ? bool(form.get('showInNav')) : undefined,
    navLabel: str(form.get('navLabel')) || undefined,
    id: num(form.get('id')) || undefined,
  })
  return ok(res)
}

export const staticSiteUpdateH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  return ok(
    updateStaticSite(user.id, user.username, {
      id: num(body.id),
      title: body.title !== undefined ? str(body.title) : undefined,
      slug: body.slug !== undefined ? str(body.slug) : undefined,
      showInNav: body.showInNav !== undefined ? bool(body.showInNav) : undefined,
      navLabel: body.navLabel !== undefined ? str(body.navLabel) : undefined,
      navOrder: body.navOrder !== undefined ? num(body.navOrder) : undefined,
    }),
  )
}

export const staticSiteDeleteH: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  deleteStaticSite(user.id, num(body.id))
  return ok({ success: true })
}

export const staticServeH: Handler = async (ctx) => {
  const p = ctx.params || {}
  const { url } = resolveStaticFile(p.username, p.slug, p.path || '')
  return Response.redirect(url, 302)
}

// ---------------- obsidian plugin ----------------

export const obsidianLatestH: Handler = async () => {
  const row = get<{
    version: string
    min_app_version: string
    notes: string
    released_at: number
    download_base: string
  }>('SELECT * FROM obsidian_plugin_meta WHERE id = 1')!
  return Response.json({
    code: 0,
    message: 'ok',
    data: {
      id: 'goalgo-blog',
      name: 'GoAlgo Blog',
      version: row.version,
      minAppVersion: row.min_app_version,
      notes: row.notes,
      releasedAt: row.released_at,
      downloadBase: row.download_base || getPluginDownloadBase(),
    },
  })
}

export const obsidianPublishH: Handler = async (ctx) => {
  const token = ctx.req.headers.get('x-plugin-publish-token') || ''
  const expected = pluginPublishToken()
  let allowed = !!expected && token === expected
  if (!allowed) {
    const user = await viewer(ctx)
    allowed = !!user?.isAdmin
  }
  if (!allowed) throw new ApiError('发布令牌无效', 401, 401)
  const body = await readJson(ctx.req)
  const version = str(body.version).trim()
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new ApiError('版本号需为 semver', 1, 400)
  run(
    `UPDATE obsidian_plugin_meta SET version = ?, min_app_version = ?, notes = ?,
       released_at = ?, download_base = ?, updated_at = datetime('now') WHERE id = 1`,
    version,
    str(body.minAppVersion) || '1.4.0',
    str(body.notes),
    num(body.releasedAt, Math.floor(Date.now() / 1000)),
    str(body.downloadBase),
  )
  return obsidianLatestH(ctx)
}

export { toBool }

export const siteSettingsGetH: Handler = async (ctx) => {
  await requireSiteOwner(ctx.req)
  return ok({ siteName: getSetting('site_name', 'Wind Blog'), faviconUrl: expandUrl(getSetting('favicon_url', '')), icpNumber: getSetting('icp_number', ''), commentsEnabled: getSetting('comments_enabled', '1') === '1', likesEnabled: getSetting('likes_enabled', '1') === '1', upyunConfigured: upyunStatus().configured })
}
export const siteSettingsSaveH: Handler = async (ctx) => {
  await requireSiteOwner(ctx.req)
  const body = await readJson(ctx.req), values: Record<string, string> = {}
  if (body.siteName !== undefined) { const name = str(body.siteName).trim(); if (!name || name.length > 64) throw new ApiError('站点名称需为 1–64 字', 1, 400); values.site_name = name }
  if (body.commentsEnabled !== undefined) values.comments_enabled = bool(body.commentsEnabled) ? '1' : '0'
  if (body.likesEnabled !== undefined) values.likes_enabled = bool(body.likesEnabled) ? '1' : '0'
  if (body.faviconUrl !== undefined) {
    const url = str(body.faviconUrl).trim()
    if (url && !/^https?:\/\//i.test(url) && !url.startsWith('/')) throw new ApiError('图标地址需为 http(s) 或站内路径', 1, 400)
    values.favicon_url = url.slice(0, 1024)
  }
  if (body.icpNumber !== undefined) values.icp_number = str(body.icpNumber).trim().slice(0, 64)
  setSettings(values)
  return ok({ success: true })
}
