import { extractHeadings, renderMarkdown } from '@/lib/markdown'

export type ArticleDisplay = { html: string; toc: { id: string; text: string; level: number }[] }
type Entry = { data: ArticleDisplay | null; promise: Promise<ArticleDisplay> }
const cache = new Map<string, Entry>()
const empty: ArticleDisplay = { html: '', toc: [] }

export function peekArticleDisplay(content: string): ArticleDisplay | null {
  return content ? cache.get(content)?.data || null : empty
}

/** Reuse hover/click preparation. Yield a paint before parsing a long body so
 * the title and loading frame are never held hostage by synchronous Markdown.
 */
export function prepareArticleDisplay(content: string): Promise<ArticleDisplay> {
  if (!content) return Promise.resolve(empty)
  const existing = cache.get(content)
  if (existing) return existing.promise
  const entry = {} as Entry
  entry.data = null
  entry.promise = new Promise<ArticleDisplay>((resolve, reject) => {
    const render = () => {
      try {
        const html = renderMarkdown(content)
        const toc = extractHeadings(content).filter((heading) => heading.level <= 4)
        entry.data = { html, toc }
        resolve(entry.data)
      } catch (error) {
        if (cache.get(content) === entry) cache.delete(content)
        reject(error)
      }
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(render, 0))
    else setTimeout(render, 0)
  })
  cache.set(content, entry)
  // Keep a handful of recently prepared articles, not the whole browsing history.
  while (cache.size > 5) cache.delete(cache.keys().next().value!)
  return entry.promise
}
