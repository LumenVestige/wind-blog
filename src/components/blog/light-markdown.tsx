'use client'

import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

/** Lightweight client-side markdown preview (no syntax highlighting). */
export function LightMarkdown({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={className ?? 'prose-blog'}
      dangerouslySetInnerHTML={{ __html: md.render(source || '') }}
    />
  )
}
