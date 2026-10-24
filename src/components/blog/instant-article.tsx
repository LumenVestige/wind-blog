'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { renderMarkdown, extractHeadings } from '@/lib/markdown'
import { formatDateLong } from '@/lib/blog-present'
import { ArticleBodyContent, ArticleView, type ArticleViewData } from '@/components/blog/article-view'
import { readArticlePreview } from '@/components/blog/article-link'
import { ArticleNav } from '@/components/blog/article-nav'
import type { TocItem } from '@/components/blog/article-toc'

type ArticlePayload = {
  id: number
  slug: string
  title: string
  summary: string
  content?: string
  tags: string[]
  publishedAt: number
  createdAt: number
  viewCount: number
  likeCount: number
  liked: boolean
  commentCount: number
  requiresPassword: boolean
  userId: number
  username: string
}

// Enough paragraphs to overflow any viewport; the card clips them at full height.
const SKELETON_LINES = Array.from({ length: 5 }, () => [
  null, '100%', '96%', '88%', '100%', '72%', '100%', '92%', '97%', '60%',
]).flat().slice(1)

function ArticleBodySkeleton() {
  return (
    <div className="mz-article-skeleton" aria-busy="true" aria-live="polite">
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

function ArticleNavSkeleton() {
  return (
    <nav className="mz-article-nav" aria-hidden>
      {['', ' is-next'].map((side) => (
        <div key={side} className={`mz-article-nav-item${side}`}>
          <span className="mz-skeleton mz-skeleton-meta" style={{ width: '3.5rem' }} />
          <span className="mz-skeleton mz-skeleton-line" style={{ width: '70%' }} />
        </div>
      ))}
    </nav>
  )
}

export function InstantArticle({
  themeId,
  username,
  categoryName,
  viewerId = 0,
  isAdmin = false,
}: {
  themeId: 'mizuki' | 'chirpy' | 'simple'
  username: string
  categoryName: string
  viewerId?: number
  isAdmin?: boolean
}) {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const preview = readArticlePreview(slug)
  const [article, setArticle] = useState<ArticlePayload | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setArticle(null)
    setFailed(false)
    api
      .get<ArticlePayload>('/api/user/blog/article/get', { username, slug })
      .then((data) => {
        if (!cancelled) setArticle(data)
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
    content: summary,
    html: '',
    tags: article?.tags || [],
    categoryName,
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
  const headings = article?.content
    ? extractHeadings(article.content).filter((h) => h.level <= 4)
    : []
  const toc: TocItem[] = headings.map((h) => ({ id: h.id, text: h.text, level: h.level }))
  const isOwner = viewerId > 0 && (article?.userId === viewerId || isAdmin)
  const body = article ? (
    <ArticleBodyContent
      themeId={themeId}
      html={renderMarkdown(article.content || '')}
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
      <ArticleNav username={article.username || username} slug={slug} />
    ) : themeId === 'mizuki' && !failed ? (
      <ArticleNavSkeleton />
    ) : null}
    </>
  )
}
