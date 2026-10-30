import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getSetting } from '@/lib/settings'
import { publicBase } from '@/server/metadata'
import { visitorIdentity } from '@/server/visitor'
import { cookieName } from '@/server/http'
import { cookies } from 'next/headers'
import { assertArticleVisible, verifyUnlockToken } from '@/server/blog/articles'
import { notFound } from 'next/navigation'
import { getArticleBySlug, listByUsername, recordView, serializeArticle } from '@/server/blog/articles'
import { listCategoriesPublic } from '@/server/blog/categories'
import { getArticleTags } from '@/server/blog/tags'
import { siteOwner } from '@/server/tenant'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { getViewer } from '@/server/session'
import { get } from '@/db'
import { extractHeadings, renderMarkdown, renderSummaryMarkdown } from '@/lib/markdown'
import { isoToUnix } from '@/lib/utils'
import { formatDateLong } from '@/lib/blog-present'
import { ArticleBodyContent, ArticleView, type ArticleViewData } from '@/components/blog/article-view'
import { InstantArticle } from '@/components/blog/instant-article'
import { Skeleton } from '@/components/ui/skeleton'
import type { TocItem } from '@/components/blog/article-toc'

export const dynamic = 'force-dynamic'

function ArticleBodyFallback() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-6" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">正文加载中…</p>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}

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

async function ArticleBody({ slug }: { slug: string }) {
  const { username, themeId, row, viewer, owner, requiresPassword } = await loadArticle(slug)
  if (!requiresPassword && row.visibility !== 'private') {
    row.view_count = recordView(row.id)
  }
  const guest = visitorIdentity(new Request('http://local', { headers: { cookie: (await cookies()).toString() } }))
  const guestLiked = !guest.fresh && !!get("SELECT 1 FROM blog_visitor_likes WHERE kind = 'article' AND target_id = ? AND visitor_key = ?", row.id, guest.key)
  const liked = viewer
    ? !!get<{ id: number }>(
        'SELECT id FROM blog_likes WHERE article_id = ? AND user_id = ?',
        row.id,
        viewer.id,
      )
    : guestLiked
  const info = serializeArticle(row, {
    viewerId: viewer?.id || 0,
    isAdmin: viewer?.isAdmin || false,
    includeContent: !requiresPassword,
    unlockTokenValid: !requiresPassword,
    tags: getArticleTags([row.id]).get(row.id) || [],
    likedSet: liked ? new Set([row.id]) : undefined,
  })
  const categories = listCategoriesPublic(username)
  const categoryName = categories.find((c) => c.id === row.category_id)?.name || ''
  const related = requiresPassword
    ? []
    : listByUsername(
        username,
        { page: 1, pageSize: 8, categoryId: row.category_id || undefined, pinnedFirst: true },
        viewer?.id || 0,
        viewer?.isAdmin || false,
      )
        .list.filter((a) => a.id !== row.id)
        .slice(0, 2)
        .map((a) => ({ id: a.id, slug: a.slug, title: a.title, summary: a.summary, summaryHtml: renderSummaryMarkdown(a.summary) }))
  const headings = requiresPassword
    ? []
    : extractHeadings(info.content || '').filter((h) => h.level <= 4)
  const toc: TocItem[] =
    headings.length > 0
      ? headings.map((h) => ({ id: h.id, text: h.text, level: h.level }))
      : info.content
        ? [{ id: 'article-top', text: row.title, level: 1 }]
        : []
  const article: ArticleViewData = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: info.content || '',
    html: renderMarkdown(info.content || ''),
    tags: info.tags,
    categoryName,
    publishedLabel: formatDateLong(info.publishedAt || info.createdAt),
    viewCount: info.viewCount,
    likeCount: info.likeCount,
    liked: info.liked,
    commentCount: info.commentCount,
    requiresPassword,
    userId: row.user_id,
  }
  return (
    <ArticleView
      themeId={themeId}
      username={username}
      isOwner={owner}
      article={article}
      related={related}
      toc={toc}
      commentsEnabled={getSetting('comments_enabled', '1') === '1'}
      likesEnabled={getSetting('likes_enabled', '1') === '1'}
      viewerId={viewer?.id || 0}
      isAdmin={!!viewer?.isAdmin}
      bodyOnly
      bodySlot={(
        <ArticleBodyContent
          themeId={themeId}
          html={article.html}
          toc={toc}
          locked={article.requiresPassword}
          articleId={article.id}
        />
      )}
    />
  )
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const author = siteOwner()
  const themeId = siteConfigData(ensureSiteConfig(author.id)).themeId
  const viewer = await getViewer()
  return (
    <InstantArticle
      themeId={themeId}
      username={author.username}
      categoryName=""
      categories={listCategoriesPublic(author.username).map(({ id, name }) => ({ id, name }))}
      viewerId={viewer?.id || 0}
      isAdmin={!!viewer?.isAdmin}
    />
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const row = getArticleBySlug(siteOwner().username, slug)
  if (!row) return { title: '文章不存在', robots: { index: false } }
  try { assertArticleVisible(row, await getViewer()) } catch { return { title: '文章不存在', robots: { index: false } } }
  const publicArticle = row.visibility === 'public' && row.moderation_status === 'approved'
  const url = new URL(`/${encodeURIComponent(row.slug)}`, await publicBase()).toString()
  return { title: row.title, description: publicArticle ? row.summary : '这是一篇受保护的文章', alternates: { canonical: url },
    robots: { index: publicArticle, follow: publicArticle }, openGraph: { title: row.title, description: publicArticle ? row.summary : '这是一篇受保护的文章', url, type: 'article' } }
}
