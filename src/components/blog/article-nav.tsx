'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ArticleLink } from '@/components/blog/article-link'
import { useFadeOutOnUnmount } from '@/components/motion/use-fade-out-on-unmount'

type Adjacent = { slug: string; title: string } | null
export type ArticleNavData = { prev: Adjacent; next: Adjacent }

const previewOf = (a: { slug: string; title: string }) => ({
  slug: a.slug,
  title: a.title,
  summary: '',
  publishedLabel: '',
  categoryName: '',
})

export function ArticleNavSkeleton() {
  const ref = useFadeOutOnUnmount<HTMLElement>()
  return (
    <nav ref={ref} className="mz-article-nav" aria-label="加载相邻文章" aria-busy="true">
      {['', ' is-next'].map((side) => (
        <div key={side} className={`mz-article-nav-item${side}`} aria-hidden="true">
          <span className="mz-skeleton mz-skeleton-line" style={{ width: '70%' }} />
        </div>
      ))}
    </nav>
  )
}

/** 文章底部的上一篇（更早）/ 下一篇（更新）导航。 */
export function ArticleNav({ username, slug, initialData }: { username: string; slug: string; initialData?: ArticleNavData }) {
  const [loaded, setData] = useState<ArticleNavData | null>(null)
  const data = initialData || loaded

  useEffect(() => {
    if (initialData) return
    let cancelled = false
    setData(null)
    api
      .get<{ prev: Adjacent; next: Adjacent }>('/api/user/blog/article/adjacent', { username, slug })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => { if (!cancelled) setData({ prev: null, next: null }) })
    return () => {
      cancelled = true
    }
  }, [username, slug, initialData])

  if (!data) return <ArticleNavSkeleton />
  if (!data.prev && !data.next) return null
  return (
    <nav className="mz-article-nav" aria-label="上一篇和下一篇">
      {data.prev ? (
        <ArticleLink preview={previewOf(data.prev)} className="mz-article-nav-item">
          <ChevronLeft className="mz-article-nav-arrow" aria-hidden="true" />
          <span className="sr-only">上一篇：</span>
          <span className="mz-article-nav-title">{data.prev.title}</span>
        </ArticleLink>
      ) : (
        <span className="mz-article-nav-empty" aria-hidden />
      )}
      {data.next ? (
        <ArticleLink preview={previewOf(data.next)} className="mz-article-nav-item is-next">
          <span className="sr-only">下一篇：</span>
          <span className="mz-article-nav-title">{data.next.title}</span>
          <ChevronRight className="mz-article-nav-arrow" aria-hidden="true" />
        </ArticleLink>
      ) : (
        <span className="mz-article-nav-empty" aria-hidden />
      )}
    </nav>
  )
}
