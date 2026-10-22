'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'

const KEY = 'wind-article-preview'

export type ArticlePreview = {
  slug: string
  title: string
  summary: string
  publishedLabel: string
  categoryName: string
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
  const router = useRouter()

  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    saveArticlePreview(preview)
    router.push(`/${preview.slug}`)
  }

  return (
    <Link href={`/${preview.slug}`} className={className} onClick={open}>
      {children}
    </Link>
  )
}
