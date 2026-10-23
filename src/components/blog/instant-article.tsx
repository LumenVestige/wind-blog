'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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

export function InstantArticle({
  themeId,
  username,
  categoryName,
}: {
  themeId: 'mizuki' | 'chirpy' | 'simple'
  username: string
  categoryName: string
}) {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const preview = readArticlePreview(slug)
  const [article, setArticle] = useState<ArticlePayload | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
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
  const body = article ? (
    <ArticleBodyContent
      themeId={themeId}
      html={renderMarkdown(article.content || '')}
      toc={toc}
      locked={article.requiresPassword}
      articleId={article.id}
    />
  ) : (
    <div className="flex justify-center py-10" aria-busy={!failed} aria-live="polite">
      {failed ? (
        <p className="text-sm text-muted-foreground">完整页面加载失败</p>
      ) : (
        <>
          <Loader2
            className="size-8 animate-spin text-[var(--mz-primary,currentColor)] motion-reduce:animate-none"
            aria-hidden
          />
          <span className="sr-only">加载中</span>
        </>
      )}
    </div>
  )

  return (
    <>
    <ArticleView
      themeId={themeId}
      username={article?.username || username}
      isOwner={false}
      article={shell}
      related={[]}
      toc={toc}
      viewerId={0}
      isAdmin={false}
      bodySlot={body}
    />
    {themeId === 'mizuki' && article ? (
      <ArticleNav username={article.username || username} slug={slug} />
    ) : null}
    </>
  )
}
