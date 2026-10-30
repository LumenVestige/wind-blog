'use client'

import { useLayoutEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isArticlePathname } from '@/lib/blog-route'
import { readArticlePreview, type ArticlePreview } from '@/lib/article-preview'
import { useFadeOutOnUnmount } from '@/components/motion/use-fade-out-on-unmount'

export function ArticleBodySkeleton() {
  const ref = useFadeOutOnUnmount<HTMLDivElement>()
  return <div ref={ref} className="mz-article-skeleton" aria-busy="true" aria-live="polite">
    <span className="sr-only">正文加载中</span>
    {Array.from({ length: 22 }, (_, index) => index % 7 === 6
      ? <div key={index} className="mz-skeleton mz-skeleton-heading" aria-hidden />
      : <div key={index} className="mz-skeleton mz-skeleton-line" style={{ width: `${[100, 96, 88, 100, 72, 92][index % 6]}%` }} aria-hidden />)}
  </div>
}

export function ArticleLoadingFrame({ preview }: { preview?: ArticlePreview | null }) {
  return <article className="mz-article is-loading" aria-busy="true">
    <header className="mz-article-header">
      {preview?.title ? <h1>{preview.title}</h1> : <div className="mz-skeleton mz-skeleton-title" aria-hidden />}
      <div className="mz-article-info"><div className="mz-article-meta">
        {preview?.publishedLabel ? <time>{preview.publishedLabel}</time> : <span className="mz-skeleton mz-skeleton-meta" style={{ width: '6rem' }} aria-hidden />}
        {preview?.categoryName ? <span>{preview.categoryName}</span> : null}
      </div></div>
    </header>
    <ArticleBodySkeleton />
  </article>
}

function Lines() {
  return <div className="mz-loading-lines" aria-hidden="true">
    {[100, 96, 80].map((width) => <div key={width} className="mz-skeleton mz-skeleton-line" style={{ width: `${width}%` }} />)}
  </div>
}

export function PageLoadingFrame({ pathname, preview }: { pathname: string; preview?: ArticlePreview | null }) {
  const article = isArticlePathname(pathname)
  return <div className="mz-page-loading" data-loading-kind={article ? 'article' : 'page'} role="status" aria-busy="true" aria-label="页面加载中">
    <span className="sr-only">页面加载中…</span>
    {article ? <ArticleLoadingFrame preview={preview} /> : pathname === '/' ? <>
      <div className="mz-loading-toolbar" aria-hidden="true"><span className="mz-skeleton" /></div>
      <div className="mz-feed-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div className="mz-feed-card" key={index}>
          <div className="mz-feed-body"><div className="mz-skeleton mz-loading-title" /><Lines /><div className="mz-skeleton mz-loading-meta" /></div>
        </div>)}
      </div>
    </> : <div className="mz-article" aria-hidden="true"><div className="mz-loading-lines"><Lines /><Lines /><Lines /></div></div>}
  </div>
}

/** Route-level streaming fallback uses the same frame as client navigation. */
export function BlogPageLoading() {
  const pathname = usePathname()
  const [preview, setPreview] = useState<ArticlePreview | null>(null)
  let slug = pathname.slice(1)
  try { slug = decodeURIComponent(slug) } catch { /* Keep malformed paths readable. */ }
  useLayoutEffect(() => {
    setPreview(readArticlePreview(slug))
  }, [slug])
  return <div className="mz-route-loading"><PageLoadingFrame pathname={pathname} preview={preview?.slug === slug ? preview : null} /></div>
}
