import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import type { ArticlePayload } from '@/lib/article-prefetch'

vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
let client: typeof import('@/lib/article-prefetch')
const article: ArticlePayload = {
  id: 1, slug: 'one', username: 'owner', userId: 1, title: 'One', summary: 'Summary', content: 'Body',
  tags: [], categoryId: null, createdAt: 1, publishedAt: 1, updatedAt: 1,
  viewCount: 3, likeCount: 0, liked: false, commentCount: 0, requiresPassword: false,
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.mocked(api.get).mockReset().mockResolvedValue(article)
  vi.mocked(api.post).mockReset().mockResolvedValue({ viewCount: 4 })
  client = await import('@/lib/article-prefetch')
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('article hover intent and cache', () => {
  it('waits 200ms, cancels a passing hover and starts immediately on activation', () => {
    const load = vi.fn()
    const intent = client.createArticleIntent(load)
    intent.schedule()
    vi.advanceTimersByTime(199)
    expect(load).not.toHaveBeenCalled()
    intent.cancel()
    vi.advanceTimersByTime(100)
    expect(load).not.toHaveBeenCalled()
    intent.schedule()
    vi.advanceTimersByTime(200)
    expect(load).toHaveBeenLastCalledWith(false)
    intent.schedule()
    intent.activate()
    vi.advanceTimersByTime(200)
    expect(load.mock.calls).toEqual([[false], [true]])
  })

  it('reuses both pending/completed prefetches and counts concurrent consumers once', async () => {
    const first = client.prefetchArticle('one')
    expect(client.prefetchArticle('one')).toBe(first)
    await first
    expect(client.prefetchArticle('one')).toBe(first)
    const read = client.loadArticleForReading('owner', 'one')
    expect(client.loadArticleForReading('owner', 'one')).toBe(read)
    await expect(read).resolves.toMatchObject({ content: 'Body', viewCount: 4 })
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/user/blog/article/view', { id: 1, updatedAt: 1 })
  })

  it('expires cached content after a minute', async () => {
    await client.prefetchArticle('one')
    vi.advanceTimersByTime(60_001)
    await client.prefetchArticle('one')
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('keeps at most five articles', async () => {
    for (let i = 0; i < 6; i++) await client.prefetchArticle(`post-${i}`)
    await client.prefetchArticle('post-0')
    expect(api.get).toHaveBeenCalledTimes(7)
  })

  it('limits speculative concurrency and respects data saver', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
    client.prefetchArticle('one')
    client.prefetchArticle('two')
    expect(client.prefetchArticle('three')).toBeNull()
    expect(api.get).toHaveBeenCalledTimes(2)
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    expect(client.prefetchArticle('four')).toBeNull()
    expect(client.prefetchArticle('four', true)).not.toBeNull()
  })

  it('falls back to a fresh detail read when cached content has changed', async () => {
    await client.prefetchArticle('one')
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Article changed'))
    vi.mocked(api.get).mockResolvedValueOnce({ ...article, content: 'Updated body', viewCount: 4 })
    await expect(client.loadArticleForReading('owner', 'one')).resolves.toMatchObject({ content: 'Updated body' })
    expect(api.get).toHaveBeenLastCalledWith('/api/user/blog/article/get', { username: 'owner', slug: 'one' })
  })

  it('does not reveal cached content when publication permission is revoked', async () => {
    await client.prefetchArticle('one')
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Not public'))
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Not found'))
    await expect(client.loadArticleForReading('owner', 'one')).rejects.toThrow('Not found')
  })

  it('retains the normal detail request for direct visits without a prefetch', async () => {
    await expect(client.loadArticleForReading('owner', 'one')).resolves.toMatchObject({ content: 'Body' })
    expect(api.post).not.toHaveBeenCalled()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/user/blog/article/get', { username: 'owner', slug: 'one' })
  })
})
