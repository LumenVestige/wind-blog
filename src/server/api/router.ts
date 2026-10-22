import type { NextRequest } from 'next/server'
import { ApiError, fail } from '@/lib/api'
import type { Ctx, Handler } from './types'
import {
  activateH, siteSettingsGetH, siteSettingsSaveH,
  activationStatusH,
  agreementGetH,
  articleCreateH,
  articleDeleteH,
  articleGetH,
  articleMineH,
  articlePinH,
  articlePinnedMineH,
  articlePinnedReorderH,
  articleUnlockH,
  articleUpdateH,
  authorsH,
  analyticsH,
  byUsernameH,
  categoriesPublicH,
  categoryCreateH,
  categoryDeleteH,
  categoryMineH,
  categoryUpdateH,
  commentCreateH, commentPendingH, commentApproveH,
  commentDeleteH,
  commentLikeH,
  commentListH,
  imageUploadApplyH,
  imageUploadStatusH,
  upyunGetH,
  upyunSaveH,
  imagesCheckH,
  likeH,
  notifyPrefH,
  obsidianLatestH,
  obsidianPublishH,
  pageCreateH,
  pageDeleteH,
  pageGetPublicH,
  pageListPublicH,
  pageMineH,
  pageReorderH,
  pageUpdateH,
  plazaH,
  recommendH,
  reportH,
  reportHandleH,
  reportListH,
  staticServeH,
  staticSiteDeleteH,
  staticSiteListPublicH,
  staticSiteMineH,
  staticSiteUpdateH,
  staticSiteUploadH,
  tagsPublicH,
  themeConfigH,
  themeStatusH,
} from './blog'
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
  register,
  setup,
  setupStatus,
  updateProfile,
  upload,
} from './auth'
import {
  adminArticlesH,
  adminAuthorsH,
  adminImageDeleteH,
  adminImageUploadH,
  adminImageUploadRequestsH,
  adminImageUploadReviewH,
  adminImagesDeleteBatchH,
  adminImagesH,
  adminModerateH,
  adminOverviewH,
  adminSettingsGetH,
  adminSettingsSetH,
} from './admin'

const routes: Record<string, Handler> = {
  'GET site/settings': siteSettingsGetH,
  'POST site/settings': siteSettingsSaveH,
  // setup (single tenant, first run)
  'GET setup/status': setupStatus,
  'POST setup': setup,
  'POST user/setup': setup,
  'GET user/setup/status': setupStatus,

  // auth / profile
  'POST user/auth/login': login,
  'POST user/auth/register': register,
  'POST user/auth/logout': logout,
  'POST user/auth/refresh': refresh,
  'POST user/auth/change-password': changePassword,
  'GET user/profile/me': me,
  'POST user/profile/update': updateProfile,
  'POST user/upload': upload,

  // activation / agreement
  'GET user/blog/activation/status': activationStatusH,
  'GET user/blog/agreement': agreementGetH,
  'POST user/blog/activate': activateH,
  'POST user/blog/notify-pref': notifyPrefH,

  // images
  'GET user/blog/image-upload/status': imageUploadStatusH,
  'GET user/blog/upyun': upyunGetH,
  'POST user/blog/upyun': upyunSaveH,
  'POST user/blog/image-upload/apply': imageUploadApplyH,
  'POST user/blog/images/check': imagesCheckH,

  // categories / tags
  'GET user/blog/category/mine': categoryMineH,
  'POST user/blog/category/create': categoryCreateH,
  'POST user/blog/category/update': categoryUpdateH,
  'POST user/blog/category/delete': categoryDeleteH,
  'GET user/blog/categories': categoriesPublicH,
  'GET user/blog/tags': tagsPublicH,

  // articles
  'GET user/blog/article/mine': articleMineH,
  'GET user/blog/article/get': articleGetH,
  'POST user/blog/article/create': articleCreateH,
  'POST user/blog/article/update': articleUpdateH,
  'POST user/blog/article/delete': articleDeleteH,
  'POST user/blog/article/unlock': articleUnlockH,
  'POST user/blog/article/pin': articlePinH,
  'GET user/blog/article/pinned/mine': articlePinnedMineH,
  'POST user/blog/article/pinned/reorder': articlePinnedReorderH,
  'GET user/blog/by-username': byUsernameH,
  'GET user/blog/recommend': recommendH,
  'GET user/blog/plaza': plazaH,
  'GET user/blog/authors': authorsH,
  'GET user/blog/analytics': analyticsH,

  // comments / likes
  'GET user/blog/comment/list': commentListH,
  'GET user/blog/comment/pending': commentPendingH,
  'POST user/blog/comment/approve': commentApproveH,
  'POST user/blog/comment/create': commentCreateH,
  'POST user/blog/comment/delete': commentDeleteH,
  'POST user/blog/comment/like': commentLikeH,
  'POST user/blog/like': likeH,

  // reports
  'POST user/blog/report': reportH,
  'GET user/blog/report/list': reportListH,
  'POST user/blog/report/handle': reportHandleH,

  // theme
  'GET user/blog/theme/status': themeStatusH,
  'POST user/blog/theme/config': themeConfigH,

  // pages
  'GET user/blog/page/mine': pageMineH,
  'GET user/blog/page/list': pageListPublicH,
  'GET user/blog/page/get': pageGetPublicH,
  'POST user/blog/page/create': pageCreateH,
  'POST user/blog/page/update': pageUpdateH,
  'POST user/blog/page/delete': pageDeleteH,
  'POST user/blog/page/reorder': pageReorderH,

  // static sites
  'GET user/blog/static-site/list': staticSiteListPublicH,
  'GET user/blog/static-site/mine': staticSiteMineH,
  'POST user/blog/static-site/upload': staticSiteUploadH,
  'POST user/blog/static-site/update': staticSiteUpdateH,
  'POST user/blog/static-site/delete': staticSiteDeleteH,

  // obsidian plugin
  'GET user/blog/obsidian-plugin/latest': obsidianLatestH,
  'POST user/blog/obsidian-plugin/publish': obsidianPublishH,

  // admin
  'GET user/blog/admin/overview': adminOverviewH,
  'GET user/blog/admin/authors': adminAuthorsH,
  'GET user/blog/admin/articles': adminArticlesH,
  'POST user/blog/admin/moderate': adminModerateH,
  'GET user/blog/admin/images': adminImagesH,
  'POST user/blog/admin/images/delete': adminImageDeleteH,
  'POST user/blog/admin/images/delete-batch': adminImagesDeleteBatchH,
  'POST user/blog/admin/image-upload': adminImageUploadH,
  'GET user/blog/admin/image-upload/requests': adminImageUploadRequestsH,
  'POST user/blog/admin/image-upload/review': adminImageUploadReviewH,
  'GET user/admin/settings': adminSettingsGetH,
  'POST user/admin/settings': adminSettingsSetH,
}

export async function dispatch(req: NextRequest, path: string[]): Promise<Response> {
  const method = req.method.toUpperCase()
  const clean = path.filter((p) => p !== '')
  try {
    // Browser mutations must come from this site. Bearer/plugin clients without
    // an Origin header remain compatible; cookie credentials cannot bypass this.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const origin = req.headers.get('origin')
      const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host') || new URL(req.url).host
      let sameHost = false
      try { sameHost = !!origin && new URL(origin).host === host } catch { sameHost = false }
      if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && !sameHost)) {
        throw new ApiError('不允许跨站操作', 403, 403)
      }
    }
    if (method === 'GET' && clean.length === 1 && clean[0] === 'health') {
      return Response.json({ code: 0, message: 'ok', data: { status: 'healthy' } })
    }
    // Dynamic: public static-site file serving
    if (
      (method === 'GET' || method === 'HEAD') &&
      clean[0] === 'user' &&
      clean[1] === 'blog' &&
      clean[2] === 'static' &&
      clean.length >= 5
    ) {
      const ctx: Ctx = {
        req,
        method,
        path: clean,
        query: new URL(req.url).searchParams,
        params: {
          username: clean[3],
          slug: clean[4],
          path: clean.slice(5).join('/'),
        },
      }
      return await staticServeH(ctx)
    }
    const key = `${method} ${clean.join('/')}`
    const handler = routes[key]
    if (!handler) return fail(`接口不存在：${key}`, 404, 404)
    const ctx: Ctx = {
      req,
      method,
      path: clean,
      query: new URL(req.url).searchParams,
    }
    return await handler(ctx)
  } catch (e) {
    if (e instanceof ApiError) return fail(e.message, e.code, e.status)
    // eslint-disable-next-line no-console
    console.error('[wind-blog] api error:', e)
    return fail('服务器内部错误', 500, 500)
  }
}
