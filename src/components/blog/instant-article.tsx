'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { loadArticleForReading, takeArticleNavigation, type ArticlePayload } from '@/lib/article-prefetch'
import { peekArticleDisplay, prepareArticleDisplay, type ArticleDisplay } from '@/lib/article-display'
import { formatDateLong } from '@/lib/blog-present'
import { ArticleBodyContent, ArticleView, type ArticleViewData } from '@/components/blog/article-view'
import { readArticlePreview, type ArticlePreview } from '@/components/blog/article-link'
import { ArticleNav, ArticleNavSkeleton } from '@/components/blog/article-nav'
import { ArticleBodySkeleton } from '@/components/blog/page-loading'
export { prepareArticleDisplay } from '@/lib/article-display'
const EMPTY_TOC: ArticleDisplay['toc'] = []

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
  const [display, setDisplay] = useState<{ content: string; value: ArticleDisplay } | null>(null)
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
    const content = opening.current.data?.content || ''
    const ready = peekArticleDisplay(content)
    setDisplay(ready ? { content, value: ready } : null)
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

  const content = article?.content || ''
  const rendered = display?.content === content ? display.value : peekArticleDisplay(content)
  useEffect(() => {
    if (!article || article.requiresPassword || rendered) return
    let cancelled = false
    void prepareArticleDisplay(content).then((value) => {
      if (!cancelled) setDisplay({ content, value })
    }, () => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [article, content, rendered])

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
  const toc = rendered?.toc || EMPTY_TOC
  const ready = !!article && (article.requiresPassword || !!rendered)
  const isOwner = viewerId > 0 && (article?.userId === viewerId || isAdmin)
  const body = ready ? (
    <ArticleBodyContent
      themeId={themeId}
      html={rendered?.html || ''}
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
      loading={!ready && !failed}
    />
    {themeId === 'mizuki' && ready ? (
      <ArticleNav key={`nav-${slug}`} username={article.username || username} slug={slug} />
    ) : themeId === 'mizuki' && !failed ? (
      <ArticleNavSkeleton />
    ) : null}
    </>
  )
}
