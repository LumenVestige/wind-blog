'use client'

import { Clock, Eye, Heart, MessageCircle } from 'lucide-react'
import Link from './blog-navigation'
import { ArticleHeading } from './article-heading'
import type { ArticleViewData } from './article-view'
import { useContext, useLayoutEffect, useRef } from 'react'
import { ArticleHeadingMotion } from './article-heading'
import { BLOG_MOTION } from '@/lib/blog-motion-events'

type HeaderData = Pick<ArticleViewData, 'slug' | 'title' | 'publishedAt' | 'updatedAt' | 'publishedLabel' | 'categoryId' | 'categoryName' | 'tags' | 'readMinutes' | 'viewCount' | 'likeCount' | 'commentCount'>

function ArticleTitleSkeleton() {
  return <div className="mz-skeleton mz-skeleton-title" aria-hidden />
}

function ArticleMetaSkeleton() {
  return (
    <div className="mz-article-meta" aria-hidden>
      {[6, 3.5, 4, 3, 3].map((w, i) => (
        <span key={i} className="mz-skeleton mz-skeleton-meta" style={{ width: `${w}rem` }} />
      ))}
    </div>
  )
}

/** Keep preview and ready header geometry identical during the body handoff. */
export function MizukiArticleHeader({ article, loading = false, isOwner = false, editHref = '' }: {
  article: HeaderData; loading?: boolean; isOwner?: boolean; editHref?: string
}) {
  const entrance = useContext(ArticleHeadingMotion)
  const info = useRef<HTMLDivElement>(null)
  const pathname = `/${encodeURIComponent(article.slug)}`
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (loading || !info.current || entrance?.pathname !== pathname || media.matches) return
    const animation = info.current.animate(
      [{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }],
      { duration: BLOG_MOTION.bodyEnter, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    )
    const reduce = () => { if (media.matches) animation.cancel() }
    media.addEventListener('change', reduce)
    return () => { animation.cancel(); media.removeEventListener('change', reduce) }
  }, [entrance, loading, pathname])
  return (
    <header className="mz-article-header">
      {article.title ? (
        <ArticleHeading title={article.title} pathname={`/${encodeURIComponent(article.slug)}`} />
      ) : loading ? (
        <ArticleTitleSkeleton />
      ) : (
        <h1 />
      )}
      <div ref={info} className="mz-article-info">
      {loading ? (
        <ArticleMetaSkeleton />
      ) : (
        <div className="mz-article-meta">
          <span>
            <time dateTime={article.publishedAt ? new Date(article.publishedAt * 1000).toISOString() : undefined}>{article.publishedLabel}</time>
          </span>
          {article.categoryName ? <span>{article.categoryName}</span> : null}
          <span><Clock aria-hidden="true" />约 {article.readMinutes ?? 1} 分钟</span>
          <span><Eye aria-hidden="true" /><span className="sr-only">阅读</span>{article.viewCount}</span>
          <span><Heart aria-hidden="true" /><span className="sr-only">喜欢</span>{article.likeCount}</span>
          <span><MessageCircle aria-hidden="true" /><span className="sr-only">评论</span>{article.commentCount}</span>
          {isOwner ? <span><Link href={editHref}>编辑</Link></span> : null}
        </div>
      )}
      {!loading && article.tags.length ? (
        <div className="mz-article-tags">
          {article.tags.map((tag) => <Link key={tag} href={`/archives?tag=${encodeURIComponent(tag)}`}>{tag}</Link>)}
        </div>
      ) : null}
      </div>
    </header>
  )
}
