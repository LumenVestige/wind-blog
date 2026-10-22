import { renderMarkdown } from '@/lib/markdown'
import { MarkdownView } from '@/components/blog/markdown-view'

export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = renderMarkdown(source || '')
  return <MarkdownView html={html} className={className} />
}
