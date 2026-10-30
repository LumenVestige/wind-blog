import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { get } from '@/db'
import { publicBase } from '@/server/metadata'
import { visitorIdentity } from '@/server/visitor'
import { cookieName } from '@/server/http'
import { adjacentArticles, assertArticleVisible, getArticleBySlug, serializeArticle, verifyUnlockToken } from '@/server/blog/articles'
import { renderArticle } from '@/server/blog/article-render'
import { listCategoriesPublic } from '@/server/blog/categories'
import { getArticleTags } from '@/server/blog/tags'
import { siteName, siteOwner } from '@/server/tenant'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { getViewer } from '@/server/session'
import { extractHeadings } from '@/lib/markdown'
import { estimateReadMinutes, formatDateLong } from '@/lib/blog-present'
import type { ArticleViewData } from '@/components/blog/article-view'
import { ArticleReader } from '@/components/blog/article-reader'

export const dynamic = 'force-dynamic'

async function loadArticle(slug: string) {
  const author = siteOwner()
  const username = author.username
  const themeId = siteConfigData(ensureSiteConfig(author.id)).themeId
  const row = getArticleBySlug(username, slug)
  if (!row) notFound()
  const viewer = await getViewer()
  const owner = !!viewer && (viewer.id === row.user_id || viewer.isAdmin)
  try { assertArticleVisible(row, viewer) } catch { notFound() }
  const token = (await cookies()).get(cookieName(`wind_unlock_${row.id}`))?.value || ''
  const requiresPassword = row.visibility === 'password' && !owner &&
    !verifyUnlockToken(token, row.id, row.password_hash)
  return { author, username, themeId, row, viewer, owner, requiresPassword }
}

/** SSR and Next route prefetch both use this authenticated, side-effect-free path. */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { username, themeId, row, viewer, owner, requiresPassword } = await loadArticle(slug)
  const guest = visitorIdentity(new Request('http://local', { headers: { cookie: (await cookies()).toString() } }))
  const liked = viewer
    ? !!get('SELECT id FROM blog_likes WHERE article_id = ? AND user_id = ?', row.id, viewer.id)
    : !guest.fresh && !!get("SELECT 1 FROM blog_visitor_likes WHERE kind = 'article' AND target_id = ? AND visitor_key = ?", row.id, guest.key)
  const info = serializeArticle(row, {
    viewerId: viewer?.id || 0,
    isAdmin: !!viewer?.isAdmin,
    includeContent: false,
    unlockTokenValid: !requiresPassword,
    tags: getArticleTags([row.id]).get(row.id) || [],
    likedSet: liked ? new Set([row.id]) : undefined,
  })
  // Never look up cached protected content before the access check above.
  const rendered = requiresPassword ? null : renderArticle(row.content)
  const categoryName = listCategoriesPublic(username).find((category) => category.id === row.category_id)?.name || ''
  const article: ArticleViewData = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: '',
    readMinutes: rendered ? estimateReadMinutes(row.content) : 0,
    html: rendered?.html || '',
    tags: info.tags,
    categoryId: info.categoryId,
    categoryName,
    publishedAt: info.publishedAt || info.createdAt,
    updatedAt: info.updatedAt,
    publishedLabel: formatDateLong(info.publishedAt || info.createdAt),
    viewCount: info.viewCount,
    likeCount: info.likeCount,
    liked,
    commentCount: info.commentCount,
    requiresPassword,
    userId: row.user_id,
  }
  return <ArticleReader
    key={row.slug}
    themeId={themeId}
    username={username}
    article={article}
    toc={rendered?.toc || []}
    revision={rendered?.revision || ''}
    countRead={!requiresPassword && row.visibility !== 'private'}
    adjacent={requiresPassword ? { prev: null, next: null } : adjacentArticles(row)}
    isOwner={owner}
    viewerId={viewer?.id || 0}
    isAdmin={!!viewer?.isAdmin}
  />
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const row = getArticleBySlug(siteOwner().username, slug)
  if (!row) return { title: '文章不存在', robots: { index: false } }
  try { assertArticleVisible(row, await getViewer()) } catch { return { title: '文章不存在', robots: { index: false } } }
  const publicArticle = row.visibility === 'public' && row.moderation_status === 'approved'
  const previewable = publicArticle || (row.visibility === 'unlisted' && row.moderation_status === 'approved')
  const name = siteName()
  const title = `${row.title}-${name}`
  const description = previewable
    ? (extractHeadings(row.content).map((heading) => heading.text).join('；') || row.summary || row.title).replace(/\s+/g, ' ').slice(0, 160)
    : '这是一篇受保护的文章'
  const url = new URL(`/${encodeURIComponent(row.slug)}`, await publicBase()).toString()
  return { title: { absolute: title }, description, alternates: { canonical: url },
    robots: { index: publicArticle, follow: publicArticle },
    openGraph: { title, description, url, siteName: name, type: 'article', locale: 'zh_CN' },
    twitter: { card: 'summary', title, description } }
}
