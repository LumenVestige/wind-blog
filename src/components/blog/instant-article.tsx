'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { loadArticleForReading, takeArticleNavigation, type ArticlePayload } from '@/lib/article-prefetch'
import { renderMarkdown, extractHeadings } from '@/lib/markdown'
import { formatDateLong } from '@/lib/blog-present'
import { ArticleBodyContent, ArticleView, type ArticleViewData } from '@/components/blog/article-view'
import { readArticlePreview, type ArticlePreview } from '@/components/blog/article-link'
import { ArticleNav, ArticleNavSkeleton } from '@/components/blog/article-nav'
import { useFadeOutOnUnmount } from '@/components/motion/use-fade-out-on-unmount'
import type { TocItem } from '@/components/blog/article-toc'

// Enough paragraphs to overflow any viewport; the card clips them at full height.
const SKELETON_LINES = Array.from({ length: 5 }, () => [
  null, '100%', '96%', '88%', '100%', '72%', '100%', '92%', '97%', '60%',
]).flat().slice(1)

function ArticleBodySkeleton() {
  const ref = useFadeOutOnUnmount<HTMLDivElement>()
  return (
    <div ref={ref} className="mz-article-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">正文加载中</span>
      {SKELETON_LINES.map((w, i) =>
        w ? (
          <div key={i} className="mz-skeleton mz-skeleton-line" style={{ width: w }} aria-hidden />
        ) : (
          <div key={i} className="mz-skeleton mz-skeleton-heading" aria-hidden />
        ),
      )}
    </div>
  )
}

export function InstantArticle({
  themeId,
  username,
  categoryName,
  categories = [],
  viewerId = 0,
  isAdmin = false,
}: {
  themeId: 'mizuki' | 'chirpy' | 'simple'
  username: string
  categoryName: string
  categories?: { id: number; name: string }[]
  viewerId?: number
  isAdmin?: boolean
}) {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const [cachedPreview, setPreview] = useState<ArticlePreview | null>(null)
  const preview = cachedPreview?.slug === slug ? cachedPreview : null
  const [loaded, setArticle] = useState<ArticlePayload | null>(null)
  const article = loaded?.slug === slug ? loaded : null
  const [failed, setFailed] = useState(false)
  const opening = useRef<{ slug: string; promise: Promise<ArticlePayload>; data: ArticlePayload | null } | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    // Hydrate the server's placeholder, then consume a page-local navigation
    // handoff before painting. A cache hit must not paint an empty body first.
    // Keep the same request across Strict Mode's repeated effect setup.
    if (opening.current?.slug !== slug) {
      const prepared = takeArticleNavigation(slug)
      const promise = prepared
        ? prepared.promise.catch(() => loadArticleForReading(username, slug))
        : loadArticleForReading(username, slug)
      opening.current = { slug, promise, data: prepared?.data || null }
    }
    setPreview(readArticlePreview(slug))
    setArticle(opening.current.data)
    setFailed(false)
    opening.current.promise
      .then((data) => {
        if (!cancelled) {
          opening.current = { slug, promise: Promise.resolve(data), data }
          setArticle(data)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug, username])

  const title = article?.title || preview?.title || ''
  const summary = article?.summary || preview?.summary || ''
  const shell: ArticleViewData = {
    id: article?.id || 0,
    slug,
    title,
    content: article?.content || summary,
    html: '',
    tags: article?.tags || preview?.tags || [],
    categoryId: article?.categoryId ?? preview?.categoryId,
    categoryName: categories.find((category) => category.id === (article?.categoryId ?? preview?.categoryId))?.name || preview?.categoryName || categoryName,
    publishedAt: article ? article.publishedAt || article.createdAt : preview?.publishedAt,
    updatedAt: article?.updatedAt || preview?.updatedAt,
    publishedLabel: article
      ? formatDateLong(article.publishedAt || article.createdAt)
      : preview?.publishedLabel || '',
    viewCount: article?.viewCount || 0,
    likeCount: article?.likeCount || 0,
    liked: article?.liked || false,
    commentCount: article?.commentCount || 0,
    requiresPassword: article?.requiresPassword || false,
    userId: article?.userId || 0,
  }
  const toc: TocItem[] = useMemo(() => article?.content
    ? extractHeadings(article.content).filter((h) => h.level <= 4).map((h) => ({ id: h.id, text: h.text, level: h.level }))
    : [], [article?.content])
  const html = useMemo(() => renderMarkdown(article?.content || ''), [article?.content])
  const isOwner = viewerId > 0 && (article?.userId === viewerId || isAdmin)
  const body = article ? (
    <ArticleBodyContent
      themeId={themeId}
      html={html}
      toc={toc}
      locked={article.requiresPassword}
      articleId={article.id}
    />
  ) : failed ? (
    <div className="flex justify-center py-10" aria-live="polite">
      <p className="text-sm text-muted-foreground">完整页面加载失败</p>
    </div>
  ) : (
    <ArticleBodySkeleton />
  )

  return (
    <>
    <ArticleView
      key={`article-${slug}`}
      themeId={themeId}
      username={article?.username || username}
      isOwner={isOwner}
      article={shell}
      related={[]}
      toc={toc}
      viewerId={viewerId}
      isAdmin={isAdmin}
      bodySlot={body}
      loading={!article && !failed}
    />
    {themeId === 'mizuki' && article ? (
      <ArticleNav key={`nav-${slug}`} username={article.username || username} slug={slug} />
    ) : themeId === 'mizuki' && !failed ? (
      <ArticleNavSkeleton />
    ) : null}
    </>
  )
}
