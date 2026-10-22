'use client'

import { useEffect, useRef } from 'react'
import { bindMarkdownCodeCopy } from '@/lib/markdown-code-copy'
import { bindMarkdownMermaid } from '@/lib/markdown-mermaid'
import { cn } from '@/lib/utils'

export function MarkdownView({
  html,
  className,
}: {
  html: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const unbindCopy = bindMarkdownCodeCopy(root)
    const videos = Array.from(root.querySelectorAll('video'))
    const hideVideo = (event: Event) => {
      const video = event.currentTarget
      if (video instanceof HTMLVideoElement) video.hidden = true
    }
    for (const video of videos) video.addEventListener('error', hideVideo)
    let cancelled = false
    void bindMarkdownMermaid(root, undefined, () => cancelled)
    return () => {
      cancelled = true
      for (const video of videos) video.removeEventListener('error', hideVideo)
      unbindCopy()
    }
  }, [html])

  return (
    <div
      ref={ref}
      className={cn('markdown-body', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
