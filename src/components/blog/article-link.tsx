'use client'

import Link from '@/components/blog/blog-navigation'
import type { MouseEvent, ReactNode } from 'react'

const KEY = 'wind-article-preview'

export type ArticlePreview = {
  slug: string
  title: string
  summary: string
  publishedLabel: string
  categoryName: string
  categoryId?: number | null
  publishedAt?: number
  updatedAt?: number
  tags?: string[]
}

export function saveArticlePreview(preview: ArticlePreview) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(preview))
  } catch {
    /* private mode */
  }
}

export function readArticlePreview(slug: string): ArticlePreview | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const preview = JSON.parse(raw) as ArticlePreview
    return preview.slug === slug ? preview : null
  } catch {
    return null
  }
}

export function ArticleLink({
  preview,
  className,
  children,
}: {
  preview: ArticlePreview
  className?: string
  children: ReactNode
}) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    saveArticlePreview(preview)
  }

  function rebound(node: HTMLAnchorElement) {
    if (!node.classList.contains('mz-feed-card') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    node.animate(
      [{ scale: getComputedStyle(node).scale }, { scale: '1.012', offset: 0.55 }, { scale: '1' }],
      { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }

  return (
    <Link href={`/${preview.slug}`} articleSlug={preview.slug} className={className} onClick={open}
      onPointerUp={(event) => { if (event.button === 0) rebound(event.currentTarget) }}
      onKeyUp={(event) => { if (event.key === 'Enter') rebound(event.currentTarget) }}>
      {children}
    </Link>
  )
}
