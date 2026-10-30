'use client'

import { BookOpen, CalendarDays, CalendarClock, Clock, Eye, Hash, Heart, MessageCircle } from 'lucide-react'
import Link from './blog-navigation'
import { ArticleHeading } from './article-heading'
import { formatDateSlash } from '@/lib/blog-present'
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
      {[6, 6, 3.5, 4].map((w, i) => (
        <span key={i} className="mz-meta-item"><span className="mz-meta-icon" /><span className="mz-skeleton mz-skeleton-meta" style={{ width: `${w}rem` }} /></span>
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
          <span className="mz-meta-item" title="发布时间">
            <span className="mz-meta-icon"><CalendarDays aria-hidden="true" /></span>
            <span className="sr-only">发布于</span>
            <time dateTime={article.publishedAt ? new Date(article.publishedAt * 1000).toISOString() : undefined}>
              {article.publishedAt ? formatDateSlash(article.publishedAt).replaceAll('/', '-') : article.publishedLabel}
            </time>
          </span>
          {article.updatedAt ? (
            <span className="mz-meta-item" title="更新时间">
              <span className="mz-meta-icon"><CalendarClock aria-hidden="true" /></span>
              <span className="sr-only">更新于</span>
              <time dateTime={new Date(article.updatedAt * 1000).toISOString()}>{formatDateSlash(article.updatedAt).replaceAll('/', '-')}</time>
            </span>
          ) : null}
          <span className="mz-meta-item">
            <span className="mz-meta-icon"><BookOpen aria-hidden="true" /></span>
            <span className="sr-only">分类：</span>
            {article.categoryId ? <Link href={`/archives?categoryId=${article.categoryId}`}>{article.categoryName || '未分类'}</Link> : <span>{article.categoryName || '未分类'}</span>}
          </span>
          <span className="mz-meta-item mz-meta-tags">
            <span className="mz-meta-icon"><Hash aria-hidden="true" /></span>
            <span className="sr-only">标签：</span>
            <span className="mz-meta-tag-list">
              {article.tags.length ? article.tags.map((tag, index) => (
                <span key={tag}>{index > 0 && <span className="mz-meta-separator" aria-hidden="true">/</span>}<Link href={`/archives?tag=${encodeURIComponent(tag)}`}>{tag}</Link></span>
              )) : '无标签'}
            </span>
          </span>
        </div>
      )}
      {loading ? <div className="mz-article-details" aria-hidden="true">{[5, 3, 3, 3].map((width, index) => <span key={index} className="mz-skeleton mz-skeleton-meta" style={{ width: `${width}rem` }} />)}</div> : (
        <div className="mz-article-details">
          <span><Clock aria-hidden="true" />约 {article.readMinutes ?? 1} 分钟</span>
          <span><Eye aria-hidden="true" /><span className="sr-only">阅读</span>{article.viewCount}</span>
          <span><Heart aria-hidden="true" /><span className="sr-only">喜欢</span>{article.likeCount}</span>
          <span><MessageCircle aria-hidden="true" /><span className="sr-only">评论</span>{article.commentCount}</span>
          {isOwner ? <Link href={editHref}>编辑文章</Link> : null}
        </div>
      )}
      </div>
    </header>
  )
}
