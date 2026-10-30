'use client'

import { usePathname } from 'next/navigation'
import { isArticlePathname } from '@/lib/blog-route'

function Lines() {
  return <div className="mz-loading-lines" aria-hidden="true">
    {[100, 96, 80].map((width) => <div key={width} className="mz-skeleton mz-skeleton-line" style={{ width: `${width}%` }} />)}
  </div>
}

/** The delay is CSS-only, so slow first visits get feedback before hydration. */
export function BlogPageLoading() {
  const pathname = usePathname()
  const article = isArticlePathname(pathname)
  return <div className="mz-page-loading" role="status" aria-busy="true" aria-label="页面加载中">
    <span className="sr-only">页面加载中…</span>
    {article ? <div className="mz-article" aria-hidden="true">
      <div className="mz-skeleton mz-skeleton-title" />
      <div className="mz-loading-lines"><Lines /><Lines /><Lines /><Lines /></div>
    </div> : pathname === '/' ? <>
      <div className="mz-loading-toolbar" aria-hidden="true"><span className="mz-skeleton" /></div>
      <div className="mz-feed-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div className="mz-feed-card" key={index}>
          <div className="mz-feed-body"><div className="mz-skeleton mz-loading-title" /><Lines /><div className="mz-skeleton mz-loading-meta" /></div>
        </div>)}
      </div>
    </> : <div className="mz-article" aria-hidden="true"><div className="mz-loading-lines"><Lines /><Lines /><Lines /></div></div>}
  </div>
}
