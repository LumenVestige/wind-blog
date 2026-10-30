'use client'

import { useEffect, useRef } from 'react'
import Viewer from 'viewerjs'
import { bindMarkdownCodeCopy } from '@/lib/markdown-code-copy'
import { bindMarkdownMermaid } from '@/lib/markdown-mermaid'
import { bindImageViewerZoom } from '@/lib/image-viewer-zoom'
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
    const viewer = root.querySelector('img') ? new Viewer(root, {
      navbar: false,
      title: false,
      toolbar: true,
      className: 'wind-image-viewer',
      transition: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      zoomable: true,
      zoomOnTouch: true,
      // A frame-coalesced handler also supports precision trackpads and Safari.
      zoomOnWheel: false,
      minZoomRatio: 0.05,
      maxZoomRatio: 20,
      // The modal image must load immediately even when the source is lazy.
      inheritedAttributes: ['crossOrigin', 'decoding', 'isMap', 'referrerPolicy', 'sizes', 'srcset', 'useMap'],
    }) : null
    const unbindZoom = viewer ? bindImageViewerZoom(root, viewer) : () => {}
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
      unbindZoom()
      viewer?.destroy()
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
