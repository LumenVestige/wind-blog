'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api-client'
import { ArticleLink } from '@/components/blog/article-link'

type Adjacent = { slug: string; title: string } | null

const previewOf = (a: { slug: string; title: string }) => ({
  slug: a.slug,
  title: a.title,
  summary: '',
  publishedLabel: '',
  categoryName: '',
})

/** 文章底部的上一篇（更早）/ 下一篇（更新）导航。 */
export function ArticleNav({ username, slug }: { username: string; slug: string }) {
  const [data, setData] = useState<{ prev: Adjacent; next: Adjacent } | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    api
      .get<{ prev: Adjacent; next: Adjacent }>('/api/user/blog/article/adjacent', { username, slug })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [username, slug])

  if (!data || (!data.prev && !data.next)) return null
  return (
    <nav className="mz-article-nav" aria-label="上一篇和下一篇">
      {data.prev ? (
        <ArticleLink preview={previewOf(data.prev)} className="mz-article-nav-item">
          <span className="mz-article-nav-label">
            <ChevronLeft />
            上一篇
          </span>
          <span className="mz-article-nav-title">{data.prev.title}</span>
        </ArticleLink>
      ) : (
        <span className="mz-article-nav-empty" aria-hidden />
      )}
      {data.next ? (
        <ArticleLink preview={previewOf(data.next)} className="mz-article-nav-item is-next">
          <span className="mz-article-nav-label">
            下一篇
            <ChevronRight />
          </span>
          <span className="mz-article-nav-title">{data.next.title}</span>
        </ArticleLink>
      ) : (
        <span className="mz-article-nav-empty" aria-hidden />
      )}
    </nav>
  )
}
