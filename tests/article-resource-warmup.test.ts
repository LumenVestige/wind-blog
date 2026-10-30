import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleArticleResourceWarmup } from '@/lib/article-resource-warmup'

let page: EventTarget & { readyState: string; visibilityState: string }
let browser: EventTarget & { requestIdleCallback?: ReturnType<typeof vi.fn>; cancelIdleCallback: ReturnType<typeof vi.fn> }
let network: { onLine: boolean; connection: { saveData: boolean; effectiveType: string }; scheduling: { isInputPending: ReturnType<typeof vi.fn> } }
let callbacks: Map<number, (deadline: { timeRemaining: () => number }) => void>
let cleanup: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
  let id = 0
  callbacks = new Map()
  page = Object.assign(new EventTarget(), { readyState: 'loading', visibilityState: 'visible' })
  browser = Object.assign(new EventTarget(), {
    requestIdleCallback: vi.fn((callback) => { callbacks.set(++id, callback); return id }),
    cancelIdleCallback: vi.fn((key) => callbacks.delete(key)),
  })
  network = { onLine: true, connection: { saveData: false, effectiveType: '4g' }, scheduling: { isInputPending: vi.fn(() => false) } }
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', browser)
  vi.stubGlobal('navigator', network)
})
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

function idle(budget = 40) {
  const [id, callback] = callbacks.entries().next().value!
  callbacks.delete(id)
  callback({ timeRemaining: () => budget })
}

describe('reading resource warmup', () => {
  it('does nothing before window load, then runs once in an idle slot', () => {
    const load = vi.fn().mockResolvedValue(undefined)
    cleanup = scheduleArticleResourceWarmup(load)
    vi.advanceTimersByTime(5000)
    expect(load).not.toHaveBeenCalled()
    expect(callbacks.size).toBe(0)
    browser.dispatchEvent(new Event('load'))
    expect(load).not.toHaveBeenCalled()
    expect(browser.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function))
    idle()
    expect(load).toHaveBeenCalledTimes(1)
    browser.dispatchEvent(new Event('online'))
    expect(callbacks.size).toBe(0)
  })

  it('yields when the browser lacks idle budget or has pending input', () => {
    page.readyState = 'complete'
    const load = vi.fn().mockResolvedValue(undefined)
    cleanup = scheduleArticleResourceWarmup(load)
    idle(2)
    expect(load).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    network.scheduling.isInputPending.mockReturnValue(true)
    idle()
    expect(load).not.toHaveBeenCalled()
    network.scheduling.isInputPending.mockReturnValue(false)
    vi.advanceTimersByTime(250)
    idle()
    expect(load).toHaveBeenCalledOnce()
  })

  it('waits for a quiet second after interaction and cancels on unmount', () => {
    page.readyState = 'complete'
    const load = vi.fn().mockResolvedValue(undefined)
    cleanup = scheduleArticleResourceWarmup(load)
    browser.dispatchEvent(new Event('pointerdown'))
    expect(callbacks.size).toBe(0)
    vi.advanceTimersByTime(999)
    expect(callbacks.size).toBe(0)
    vi.advanceTimersByTime(1)
    expect(callbacks.size).toBe(1)
    cleanup()
    expect(callbacks.size).toBe(0)
    browser.dispatchEvent(new Event('load'))
    browser.dispatchEvent(new Event('keydown'))
    vi.runAllTimers()
    expect(load).not.toHaveBeenCalled()
  })

  it('postpones hidden/offline work, and skips speculative work on a limited connection', () => {
    page.readyState = 'complete'
    page.visibilityState = 'hidden'
    const load = vi.fn().mockResolvedValue(undefined)
    cleanup = scheduleArticleResourceWarmup(load)
    expect(callbacks.size).toBe(0)
    page.visibilityState = 'visible'
    network.onLine = false
    page.dispatchEvent(new Event('visibilitychange'))
    expect(callbacks.size).toBe(0)
    network.onLine = true
    network.connection.saveData = true
    browser.dispatchEvent(new Event('online'))
    expect(callbacks.size).toBe(0)
    network.connection.saveData = false
    network.connection.effectiveType = '2g'
    browser.dispatchEvent(new Event('online'))
    expect(callbacks.size).toBe(0)
    network.connection.effectiveType = '4g'
    browser.dispatchEvent(new Event('online'))
    page.visibilityState = 'hidden'
    idle()
    expect(load).not.toHaveBeenCalled()
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    idle()
    expect(load).toHaveBeenCalledOnce()
  })

  it('uses a quiet 1500ms fallback without requestIdleCallback', () => {
    browser.requestIdleCallback = undefined
    page.readyState = 'complete'
    const load = vi.fn().mockResolvedValue(undefined)
    cleanup = scheduleArticleResourceWarmup(load)
    vi.advanceTimersByTime(1499)
    expect(load).not.toHaveBeenCalled()
    browser.dispatchEvent(new Event('wheel'))
    vi.advanceTimersByTime(2499)
    expect(load).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(load).toHaveBeenCalledOnce()
  })

  it('contains background failures without interrupting the current page', async () => {
    page.readyState = 'complete'
    cleanup = scheduleArticleResourceWarmup(vi.fn().mockRejectedValue(new Error('offline')))
    expect(() => idle()).not.toThrow()
    await Promise.resolve()
  })
})
