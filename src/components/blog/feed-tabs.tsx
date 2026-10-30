'use client'

import Link, { usePendingBlogHref } from './blog-navigation'
import { cn } from '@/lib/utils'

export function FeedTabs({ items, sort }: {
  items: { href: string; label: string; sort?: string }[]
  sort?: string
}) {
  const pendingHref = usePendingBlogHref()
  const pending = pendingHref ? new URL(pendingHref, 'http://blog.local') : null
  const selected = pending?.pathname === '/' ? pending.searchParams.get('sort') || undefined : sort
  return (
    <nav className="mz-feed-tabs" aria-label="文章排序">
      {items.map((item) => (
        <Link key={item.label} href={item.href} scroll={false}
          className={cn('mz-feed-tab', selected === item.sort && 'is-active')}
          aria-current={selected === item.sort ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
