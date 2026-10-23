'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type Category = { id: number; name: string; articleCount: number }
type TagCount = { name: string; count: number }

/** Current home-feed query with `page` reset, or null off the home page. */
function useFeedParams() {
  const pathname = usePathname()
  const params = useSearchParams()
  if (pathname !== '/') return null
  const next = new URLSearchParams(params)
  next.delete('page')
  return next
}

function toHref(params: URLSearchParams) {
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

/**
 * Sidebar categories: one at a time. On the home feed a click switches the
 * category (clicking the active one clears it) and keeps tags, sort and search;
 * elsewhere it opens the feed filtered by that category.
 */
export function CategoryFilterList({ categories }: { categories: Category[] }) {
  const feed = useFeedParams()
  const active = feed?.get('categoryId') || ''

  function href(id: number) {
    if (!feed) return `/?categoryId=${id}`
    const next = new URLSearchParams(feed)
    if (active === String(id)) next.delete('categoryId')
    else next.set('categoryId', String(id))
    return toHref(next)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const on = active === String(c.id)
        return (
          <Link
            key={c.id}
            href={href(c.id)}
            className={cn('mz-tag', on && 'is-active')}
            aria-current={on ? 'true' : undefined}
          >
            {c.name}
            {c.articleCount != null ? ` · ${c.articleCount}` : ''}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * Sidebar tags: several at once, combined with AND. On the home feed a click
 * toggles the tag in the current filter; elsewhere it opens a fresh filter.
 */
export function TagFilterList({ tags }: { tags: TagCount[] }) {
  const feed = useFeedParams()
  const active = feed?.getAll('tag') || []

  function href(name: string) {
    if (!feed) return `/?tag=${encodeURIComponent(name)}`
    const next = new URLSearchParams(feed)
    const names = active.includes(name)
      ? active.filter((t) => t !== name)
      : [...active, name]
    next.delete('tag')
    names.forEach((t) => next.append('tag', t))
    return toHref(next)
  }

  return (
    <div className="mz-tag-cloud">
      {tags.map((t) => {
        const on = active.includes(t.name)
        return (
          <Link
            key={t.name}
            href={href(t.name)}
            className={cn('mz-tag', on && 'is-active')}
            aria-pressed={feed ? on : undefined}
          >
            {t.name}
            {` · ${t.count}`}
          </Link>
        )
      })}
    </div>
  )
}

/** Plain links without filter state, for the Suspense fallbacks. */
export function CategoryLinks({ categories }: { categories: Category[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => (
        <Link key={c.id} href={`/?categoryId=${c.id}`} className="mz-tag">
          {c.name}
          {c.articleCount != null ? ` · ${c.articleCount}` : ''}
        </Link>
      ))}
    </div>
  )
}

export function TagLinks({ tags }: { tags: TagCount[] }) {
  return (
    <div className="mz-tag-cloud">
      {tags.map((t) => (
        <Link key={t.name} href={`/?tag=${encodeURIComponent(t.name)}`} className="mz-tag">
          {t.name}
          {` · ${t.count}`}
        </Link>
      ))}
    </div>
  )
}
