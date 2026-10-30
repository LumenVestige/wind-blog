'use client'

import Link from '@/components/blog/blog-navigation'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const KEY = 'wind-article-preview'

/** Only the title line is a pointer trigger; the popup never captures hover. */
export function FeedArticleTitle({ title }: { title: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const toggleTooltip = useCallback((next: boolean) => {
    const text = ref.current?.querySelector<HTMLElement>('.mz-feed-title-text')
    const clipped = !!text && (text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1)
    setTooltipOpen(next && clipped)
  }, [])

  useEffect(() => {
    // Keep one keyboard stop per card; focusing its link can reveal the title
    // without making the heading a second interactive element inside it.
    const link = ref.current?.closest('a')
    if (!link) return
    const focus = () => { if (link.matches(':focus-visible')) toggleTooltip(true) }
    const blur = () => toggleTooltip(false)
    link.addEventListener('focus', focus)
    link.addEventListener('blur', blur)
    return () => {
      link.removeEventListener('focus', focus)
      link.removeEventListener('blur', blur)
    }
  }, [toggleTooltip])

  return <TooltipProvider delayDuration={0} disableHoverableContent>
    <Tooltip open={tooltipOpen} onOpenChange={toggleTooltip}>
      <TooltipTrigger asChild>
        <h2 ref={ref} className="mz-feed-title"><span className="mz-feed-title-text">{title}</span><ChevronRight className="mz-feed-enter" aria-hidden="true" /></h2>
      </TooltipTrigger>
      <TooltipContent className="mz-title-tooltip" side="top" align="start" sideOffset={8} collisionPadding={12}>
        {title}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
}

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
