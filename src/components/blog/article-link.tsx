'use client'

import Link from '@/components/blog/blog-navigation'
import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  function toggleTooltip(next: boolean) {
    const text = linkRef.current?.querySelector<HTMLElement>('.mz-feed-title-text')
    const clipped = !!text && (text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1)
    setTooltipOpen(next && clipped)
  }
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

  const link = (
    <Link ref={linkRef} href={`/${preview.slug}`} articleSlug={preview.slug} className={className} onClick={open}
      onPointerUp={(event) => { if (event.button === 0) rebound(event.currentTarget) }}
      onKeyUp={(event) => { if (event.key === 'Enter') rebound(event.currentTarget) }}>
      {children}
    </Link>
  )
  if (!className?.split(/\s+/).includes('mz-feed-card')) return link
  return <TooltipProvider delayDuration={140} skipDelayDuration={0} disableHoverableContent>
    <Tooltip open={tooltipOpen} onOpenChange={toggleTooltip}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent className="mz-title-tooltip" side="top" align="start" sideOffset={8} collisionPadding={12}>
        {preview.title}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
}
