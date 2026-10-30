import { api } from '@/lib/api-client'

export const ARTICLE_HOVER_MS = 200
const CACHE_TTL_MS = 60_000
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
  expires: number
  controller: AbortController
  pending: boolean
}
const cache = new Map<string, Entry>()
const reads = new Map<string, Promise<ArticlePayload>>()

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
    expires: Date.now() + CACHE_TTL_MS,
    controller,
    pending: true,
  }
  cache.set(slug, entry)
  void entry.promise.then(() => {
    entry.pending = false
    entry.expires = Date.now() + CACHE_TTL_MS
    clearTimeout(timeout)
  }, () => {
    clearTimeout(timeout)
    if (cache.get(slug) === entry) cache.delete(slug)
  })
  return entry.promise
}

/** Reuse speculative content, validating and counting only once the page opens. */
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
        const counts = await api.post<Pick<ArticlePayload, 'viewCount' | 'likeCount' | 'liked' | 'commentCount'>>(
          '/api/user/blog/article/view', { id: data.id, updatedAt: data.updatedAt },
        )
        return { ...data, ...counts }
      } catch {
        // Protected/changed/expired content uses the existing authenticated read path.
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
