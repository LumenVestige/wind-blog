'use client'

import { isArticlePathname } from '@/lib/blog-route'
import type { ArticlePreview } from '@/lib/article-preview'
import { useFadeOutOnUnmount } from '@/components/motion/use-fade-out-on-unmount'
import { MizukiArticleHeader } from './article-header'
import { MizukiArticleCard } from './article-card-surface'

export function ArticleBodySkeleton() {
  return <div className="mz-article-skeleton" aria-busy="true" aria-live="polite">
    <span className="sr-only">正文加载中</span>
    {Array.from({ length: 22 }, (_, index) => index % 7 === 6
      ? <div key={index} className="mz-skeleton mz-skeleton-heading" aria-hidden />
      : <div key={index} className="mz-skeleton mz-skeleton-line" style={{ width: `${[100, 96, 88, 100, 72, 92][index % 6]}%` }} aria-hidden />)}
  </div>
}
export function ArticleLoadingFrame({ preview, pathname }: { preview?: ArticlePreview | null; pathname: string }) {
  return <MizukiArticleCard pathname={pathname} loading aria-busy="true">
    <MizukiArticleHeader loading article={{
      slug: preview?.slug || '', title: preview?.title || '', publishedAt: preview?.publishedAt, updatedAt: preview?.updatedAt,
      publishedLabel: preview?.publishedLabel || '', categoryId: preview?.categoryId, categoryName: preview?.categoryName || '',
      tags: preview?.tags || [], viewCount: 0, likeCount: 0,
    }} />
    <ArticleBodySkeleton />
  </MizukiArticleCard>
}

function Lines() {
  return <div className="mz-loading-lines" aria-hidden="true">
    {[100, 96, 80].map((width) => <div key={width} className="mz-skeleton mz-skeleton-line" style={{ width: `${width}%` }} />)}
  </div>
}

export function PageLoadingFrame({ pathname, preview, feedOnly = false }: { pathname: string; preview?: ArticlePreview | null; feedOnly?: boolean }) {
  const article = isArticlePathname(pathname)
  const ref = useFadeOutOnUnmount<HTMLDivElement>()
  return <div ref={ref} className="mz-page-loading" data-loading-kind={article ? 'article' : 'page'} role="status" aria-busy="true" aria-label="页面加载中">
    <span className="sr-only">页面加载中…</span>
    {article ? <ArticleLoadingFrame pathname={pathname} preview={preview} /> : pathname === '/' ? <>
      {!feedOnly && <div className="mz-loading-toolbar" aria-hidden="true"><span className="mz-skeleton" /></div>}
      <div className="mz-feed-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div className="mz-feed-card" key={index}>
          <div className="mz-feed-body"><div className="mz-skeleton mz-loading-title" /><Lines /><div className="mz-skeleton mz-loading-meta" /></div>
        </div>)}
      </div>
    </> : <div className="mz-article" aria-hidden="true"><div className="mz-loading-lines"><Lines /><Lines /><Lines /></div></div>}
  </div>
}
