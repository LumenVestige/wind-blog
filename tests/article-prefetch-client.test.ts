import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '@/lib/article-prefetch'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('article route prefetch intent', () => {
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

  it('skips speculative work on slow connections and data saver', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    expect(client.canPrefetchArticle()).toBe(false)
    vi.stubGlobal('navigator', { connection: { effectiveType: '2g' } })
    expect(client.canPrefetchArticle()).toBe(false)
    vi.stubGlobal('navigator', { connection: { effectiveType: '4g' } })
    expect(client.canPrefetchArticle()).toBe(true)
  })
})
