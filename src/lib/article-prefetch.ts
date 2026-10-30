import { api } from '@/lib/api-client'

export const ARTICLE_HOVER_MS = 200
const CACHE_TTL_MS = 5_000
const CACHE_LIMIT = 5
const PENDING_LIMIT = 2

export type ArticlePayload = {
  id: number
  slug: string
  username: string
  userId: number
  title: string
  summary: string
  content?: string
  tags: string[]
  categoryId: number | null
  createdAt: number
  publishedAt: number
  updatedAt: number
  viewCount: number
  likeCount: number
  liked: boolean
  commentCount: number
  requiresPassword: boolean
}

type Entry = {
  promise: Promise<ArticlePayload>
  data: ArticlePayload | null
  expires: number
  controller: AbortController
  pending: boolean
}
const cache = new Map<string, Entry>()
const reads = new Map<string, Promise<ArticlePayload>>()
type NavigationRead = { promise: Promise<ArticlePayload>; data: ArticlePayload | null; expires: number }
const navigationReads = new Map<string, NavigationRead>()

/** Hand fresh page-local content to navigation without another network gate.
 * Hover still only fetches public content and never counts a visit.
 */
export function prepareArticleForNavigation(slug: string): Promise<ArticlePayload> | null {
  for (const [key, entry] of navigationReads) if (entry.expires <= Date.now()) navigationReads.delete(key)
  const existing = navigationReads.get(slug)
  if (existing) return existing.promise
  navigationReads.clear()
  const prefetched = cache.get(slug)
  if (!prefetched || prefetched.expires <= Date.now()) return null
  const entry: NavigationRead = {
    // Consume the entry now so leaving the source page cannot abort this read.
    promise: loadArticleForReading('', slug),
    data: prefetched.data,
    expires: Date.now() + 8000,
  }
  navigationReads.set(slug, entry)
  void entry.promise.then((data) => { entry.data = data }, () => {
    if (navigationReads.get(slug) === entry) navigationReads.delete(slug)
  })
  return entry.promise
}

/** A navigation hands its content/request to the article exactly once. */
export function takeArticleNavigation(slug: string): NavigationRead | null {
  const entry = navigationReads.get(slug)
  navigationReads.delete(slug)
  return entry && entry.expires > Date.now() ? entry : null
}

/** Speculation belongs to its source page; only the selected one-shot handoff survives. */
export function clearArticlePrefetch(pathname: string) {
  for (const slug of cache.keys()) evict(slug)
  for (const slug of navigationReads.keys()) {
    if (pathname !== `/${slug}` && pathname !== `/${encodeURIComponent(slug)}`) navigationReads.delete(slug)
  }
}

function evict(slug: string) {
  cache.get(slug)?.controller.abort()
  cache.delete(slug)
}

export function canPrefetchArticle() {
  const connection = typeof navigator === 'undefined' ? undefined :
    (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType || '')
}

/** A bounded, short-lived cache of public content. No read counter is touched. */
export function prefetchArticle(slug: string, immediate = false): Promise<ArticlePayload> | null {
  if (!immediate && !canPrefetchArticle()) return null
  for (const [key, entry] of cache) if (entry.expires <= Date.now()) evict(key)
  const existing = cache.get(slug)
  if (existing) return existing.promise
  if (!immediate && [...cache.values()].filter((entry) => entry.pending).length >= PENDING_LIMIT) return null
  while (cache.size >= CACHE_LIMIT) evict(cache.keys().next().value!)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const entry: Entry = {
    promise: api.get<ArticlePayload>('/api/user/blog/article/prefetch', { slug }, { signal: controller.signal }),
    data: null,
    expires: Date.now() + CACHE_TTL_MS,
    controller,
    pending: true,
  }
  cache.set(slug, entry)
  void entry.promise.then((data) => {
    entry.data = data
    entry.pending = false
    entry.expires = Date.now() + CACHE_TTL_MS
    clearTimeout(timeout)
  }, () => {
    clearTimeout(timeout)
    if (cache.get(slug) === entry) cache.delete(slug)
  })
  return entry.promise
}

/** Render fresh speculative content immediately; account for the visit in the background. */
export function loadArticleForReading(username: string, slug: string): Promise<ArticlePayload> {
  const key = `${username}:${slug}`
  const pending = reads.get(key)
  if (pending) return pending
  const entry = cache.get(slug)
  if (entry && entry.expires <= Date.now()) evict(slug)
  const prefetched = cache.get(slug)?.promise
  cache.delete(slug)
  const request = (async () => {
    if (prefetched) {
      try {
        const data = await prefetched
        void api.post(
          '/api/user/blog/article/view', { id: data.id, updatedAt: data.updatedAt },
        ).catch(() => { /* Read accounting never blocks already-prefetched content. */ })
        return data
      } catch (error) {
        // The target page knows its author and can retry a failed handoff.
        if (!username) throw error
      }
    }
    return api.get<ArticlePayload>('/api/user/blog/article/get', { username, slug })
  })()
  reads.set(key, request)
  const complete = () => { if (reads.get(key) === request) reads.delete(key) }
  void request.then(complete, complete)
  return request
}

export function createArticleIntent(load: (immediate: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => { if (timer) clearTimeout(timer); timer = undefined }
  return {
    schedule() {
      cancel()
      timer = setTimeout(() => { timer = undefined; load(false) }, ARTICLE_HOVER_MS)
    },
    cancel,
    activate() { cancel(); load(true) },
  }
}
