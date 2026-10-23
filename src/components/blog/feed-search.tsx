'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { BlogQueryValue } from '@/lib/blog-present'

/** Home feed search; clearing the box drops the keyword without a submit. */
export function FeedSearch({
  keyword,
  clearHref,
  hidden,
}: {
  keyword: string
  /** Current list URL without `q` (and page), used once the box is emptied. */
  clearHref: string
  hidden: Record<string, BlogQueryValue>
}) {
  const router = useRouter()
  return (
    <form action="/" className="mz-feed-search" role="search">
      {Object.entries(hidden).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : [v]).map((item, i) =>
          item ? <input key={`${k}-${i}`} type="hidden" name={k} value={item} /> : null,
        ),
      )}
      <input
        key={keyword}
        type="search"
        name="q"
        defaultValue={keyword}
        placeholder="搜索文章标题…"
        aria-label="搜索文章"
        className="mz-feed-search-input"
        onChange={(e) => {
          if (keyword && !e.target.value.trim()) router.push(clearHref)
        }}
      />
      <button type="submit" className="mz-feed-search-btn" aria-label="搜索">
        <Search />
      </button>
    </form>
  )
}
