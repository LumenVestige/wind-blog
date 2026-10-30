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
    await expect(read).resolves.toMatchObject({ content: 'Body', viewCount: 3 })
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/user/blog/article/view', { id: 1, updatedAt: 1 })
  })

  it('expires speculative content after five seconds even on the same page', async () => {
    await client.prefetchArticle('one')
    vi.advanceTimersByTime(5_001)
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

  it('does not gate fresh cached content on background read accounting', async () => {
    await client.prefetchArticle('one')
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Article changed'))
    await expect(client.loadArticleForReading('owner', 'one')).resolves.toMatchObject({ content: 'Body' })
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('keeps a just-prefetched body readable even if the background counter fails', async () => {
    await client.prefetchArticle('one')
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Not public'))
    await expect(client.loadArticleForReading('owner', 'one')).resolves.toMatchObject({ content: 'Body' })
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('retains the normal detail request for direct visits without a prefetch', async () => {
    await expect(client.loadArticleForReading('owner', 'one')).resolves.toMatchObject({ content: 'Body' })
    expect(api.post).not.toHaveBeenCalled()
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/user/blog/article/get', { username: 'owner', slug: 'one' })
  })

  it('hands the ready body to navigation synchronously and consumes it once', async () => {
    await client.prefetchArticle('one')
    expect(api.post).not.toHaveBeenCalled()
    const navigation = client.prepareArticleForNavigation('one')
    expect(client.prepareArticleForNavigation('one')).toBe(navigation)
    const ready = client.takeArticleNavigation('one')
    expect(ready?.data).toMatchObject({ content: 'Body', viewCount: 3 })
    await navigation
    await expect(ready?.promise).resolves.toMatchObject({ content: 'Body' })
    expect(client.takeArticleNavigation('one')).toBeNull()
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('does not wait for an unfinished counter when opening cached content', async () => {
    let confirm!: (value: { viewCount: number }) => void
    vi.mocked(api.post).mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve }))
    await client.prefetchArticle('one')
    const navigation = client.prepareArticleForNavigation('one')
    await vi.advanceTimersByTimeAsync(0)
    const pending = client.takeArticleNavigation('one')
    expect(pending?.data).toMatchObject({ content: 'Body' })
    expect(pending?.promise).toBe(navigation)
    await expect(pending?.promise).resolves.toMatchObject({ content: 'Body', viewCount: 3 })
    confirm({ viewCount: 4 })
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('clears the source page cache on navigation and only keeps the selected handoff', async () => {
    await client.prefetchArticle('one')
    await client.prefetchArticle('two')
    await client.prepareArticleForNavigation('one')
    client.clearArticlePrefetch('/one')
    expect(client.takeArticleNavigation('one')?.data?.content).toBe('Body')
    await client.prefetchArticle('two')
    expect(api.get).toHaveBeenCalledTimes(3)
    client.clearArticlePrefetch('/')
    await client.prefetchArticle('one')
    expect(api.get).toHaveBeenCalledTimes(4)
  })

  it('does not retain abandoned navigation content indefinitely', async () => {
    await client.prefetchArticle('one')
    await client.prepareArticleForNavigation('one')
    vi.advanceTimersByTime(8001)
    expect(client.takeArticleNavigation('one')).toBeNull()
    expect(client.prepareArticleForNavigation('missing')).toBeNull()
  })

  it('discards an abandoned handoff when navigating somewhere else', async () => {
    await client.prefetchArticle('one')
    await client.prepareArticleForNavigation('one')
    client.clearArticlePrefetch('/archives')
    expect(client.takeArticleNavigation('one')).toBeNull()
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Not found'))
    await expect(client.loadArticleForReading('owner', 'one')).rejects.toThrow('Not found')
  })
})
