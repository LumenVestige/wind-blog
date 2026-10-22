import { renderSummaryMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

/**
 * Card and list excerpts: readable text, with math rendered.
 * Put line-clamp on this element, not on a wrapper around it.
 */
export function MarkdownSummary({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const html = content?.trim() ? renderSummaryMarkdown(content) : ''
  if (!html) return null
  return (
    <div
      className={cn('markdown-summary min-w-0 max-w-full [overflow-wrap:anywhere]', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
