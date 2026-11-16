'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link, { usePendingBlogHref } from './blog-navigation'
import { paginationItems, parsePage } from '@/lib/pagination'
import { cn } from '@/lib/utils'

/** Public feed pagination; filters and an explicitly selected page size survive. */
export function BlogPagination({ page, total, pageSize, defaultPageSize = 12, href, label = '文章列表分页' }: {
  page: number
  total: number
  pageSize: number
  defaultPageSize?: number
  href: string
  label?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const pendingHref = usePendingBlogHref()
  const pending = pendingHref ? new URL(pendingHref, 'http://blog.local') : null
  const selected = pending?.pathname === href.split('?')[0] ? parsePage(pending.searchParams.get('page')) : page
  const current = Math.min(pages, Math.max(1, selected))
  function url(next: number) {
    const [pathname, search = ''] = href.split('?')
    const params = new URLSearchParams(search)
    if (next === 1) params.delete('page')
    else params.set('page', String(next))
    if (pageSize !== defaultPageSize) params.set('pageSize', String(pageSize))
    return pathname + (params.size ? `?${params}` : '')
  }
  return (
    <nav className="mz-pagination" aria-label={label}>
      <span className="sr-only">第 {current} 页，共 {pages} 页，共 {total} 篇文章</span>
      {current > 1 ? (
        <Link href={url(current - 1)} className="mz-page-arrow" aria-label="上一页" rel="prev"><ChevronLeft aria-hidden="true" /></Link>
      ) : (
        <button className="mz-page-arrow" type="button" aria-label="上一页" disabled><ChevronLeft aria-hidden="true" /></button>
      )}
      <div className="mz-page-numbers">
        {paginationItems(current, pages).map((item) => typeof item === 'number' ? (
          <Link key={item} href={url(item)} className={cn('mz-page-number', item === current && 'is-active')}
            aria-label={`第 ${item} 页`} aria-current={item === current ? 'page' : undefined}>
            {item}
          </Link>
        ) : <span className="mz-page-gap" key={item} aria-hidden="true">…</span>)}
      </div>
      {current < pages ? (
        <Link href={url(current + 1)} className="mz-page-arrow" aria-label="下一页" rel="next"><ChevronRight aria-hidden="true" /></Link>
      ) : (
        <button className="mz-page-arrow" type="button" aria-label="下一页" disabled><ChevronRight aria-hidden="true" /></button>
      )}
    </nav>
  )
}
