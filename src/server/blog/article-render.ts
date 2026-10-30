import { createHash } from 'node:crypto'
import { extractHeadings, renderMarkdown } from '@/lib/markdown'

export type RenderedArticle = {
  html: string
  toc: { id: string; text: string; level: number }[]
  revision: string
}
const cache = new Map<string, { value: RenderedArticle; bytes: number }>()
const MAX_ENTRIES = 32
const MAX_BYTES = 8 * 1024 * 1024
let cachedBytes = 0

export function articleRevision(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/** Content-addressed, process-local rendering, shared by SSR and RSC prefetch.
 * Call only after checking visibility/unlock access. Content changes invalidate
 * immediately, including edits within the same SQLite timestamp second.
 */
export function renderArticle(content: string): RenderedArticle {
  const key = articleRevision(content)
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached.value
  }
  const value = {
    html: renderMarkdown(content),
    toc: extractHeadings(content).filter((heading) => heading.level <= 4),
    revision: key,
  }
  const bytes = Buffer.byteLength(value.html) + Buffer.byteLength(JSON.stringify(value.toc))
  if (bytes <= MAX_BYTES) {
    while (cache.size && (cache.size >= MAX_ENTRIES || cachedBytes + bytes > MAX_BYTES)) {
      const oldest = cache.keys().next().value!
      cachedBytes -= cache.get(oldest)!.bytes
      cache.delete(oldest)
    }
    cache.set(key, { value, bytes })
    cachedBytes += bytes
  }
  return value
}
