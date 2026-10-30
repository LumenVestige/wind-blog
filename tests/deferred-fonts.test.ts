import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeferredFonts } from '@/components/blog/deferred-fonts'

const hooks = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined }))
vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => { hooks.cleanup = effect() },
}))

describe('optional Chinese font loading', () => {
  let events: EventTarget
  let appendChild: ReturnType<typeof vi.fn>
  let createElement: ReturnType<typeof vi.fn>
  let idleCallback: (() => void) | undefined
  let requestIdleCallback: ReturnType<typeof vi.fn>
  let cancelIdleCallback: ReturnType<typeof vi.fn>
  let link: { rel: string; href: string; setAttribute: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.useFakeTimers()
    events = new EventTarget()
    idleCallback = undefined
    link = { rel: '', href: '', setAttribute: vi.fn(), remove: vi.fn() }
    appendChild = vi.fn()
    createElement = vi.fn(() => link)
    requestIdleCallback = vi.fn((callback) => { idleCallback = callback; return 7 })
    cancelIdleCallback = vi.fn()
    vi.stubGlobal('document', { readyState: 'loading', createElement, head: { appendChild } })
    vi.stubGlobal('window', {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      requestIdleCallback, cancelIdleCallback,
    })
  })
  afterEach(() => {
    hooks.cleanup?.()
    hooks.cleanup = undefined
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not request any optional resources when disabled', () => {
    DeferredFonts({ href: null })
    events.dispatchEvent(new Event('load'))
    vi.runAllTimers()
    expect(requestIdleCallback).not.toHaveBeenCalled()
    expect(createElement).not.toHaveBeenCalled()
  })
  it('waits for load and idle, then attaches the stylesheet at low priority', () => {
    DeferredFonts({ href: '/fonts/wenkai/style.css' })
    expect(requestIdleCallback).not.toHaveBeenCalled()
    events.dispatchEvent(new Event('load'))
    expect(appendChild).not.toHaveBeenCalled()
    idleCallback!()
    expect(link.href).toBe('/fonts/wenkai/style.css')
    expect(link.rel).toBe('stylesheet')
    expect(link.setAttribute).toHaveBeenCalledWith('fetchpriority', 'low')
    expect(appendChild).toHaveBeenCalledOnce()
    hooks.cleanup!()
    expect(link.remove).toHaveBeenCalledOnce()
    hooks.cleanup = undefined
  })
  it('cancels pending work when disabled before page load or while idle', () => {
    DeferredFonts({ href: '/fonts/wenkai/style.css' })
    hooks.cleanup!()
    events.dispatchEvent(new Event('load'))
    expect(requestIdleCallback).not.toHaveBeenCalled()

    Object.assign(document, { readyState: 'complete' })
    DeferredFonts({ href: '/fonts/wenkai/style.css' })
    hooks.cleanup!()
    expect(cancelIdleCallback).toHaveBeenCalledWith(7)
    idleCallback!()
    expect(appendChild).not.toHaveBeenCalled()
    hooks.cleanup = undefined
  })
  it('supports browsers without requestIdleCallback and cancels the fallback timer', () => {
    Object.assign(document, { readyState: 'complete' })
    Object.assign(window, { requestIdleCallback: undefined })
    DeferredFonts({ href: '/fonts/wenkai/style.css' })
    expect(appendChild).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(appendChild).toHaveBeenCalledOnce()
    hooks.cleanup!()

    appendChild.mockClear()
    DeferredFonts({ href: '/fonts/wenkai/style.css' })
    hooks.cleanup!()
    vi.runAllTimers()
    expect(appendChild).not.toHaveBeenCalled()
    hooks.cleanup = undefined
  })
  it('waits for code visibility and discovers blocks inserted by later navigation', () => {
    Object.assign(document, { readyState: 'complete' })
    let nodes: object[] = []
    Object.assign(document, { body: {}, querySelectorAll: vi.fn(() => nodes) })
    let intersect!: (entries: { isIntersecting: boolean }[]) => void
    let mutate!: () => void
    const observeCode = vi.fn(), disconnectVisibility = vi.fn(), disconnectMutations = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof intersect) { intersect = callback }
      observe = observeCode
      disconnect = disconnectVisibility
    })
    vi.stubGlobal('MutationObserver', class {
      constructor(callback: () => void) { mutate = callback }
      observe = vi.fn()
      disconnect = disconnectMutations
    })
    DeferredFonts({ href: '/fonts/mono.css', selector: 'pre' })
    expect(observeCode).not.toHaveBeenCalled()
    expect(requestIdleCallback).not.toHaveBeenCalled()
    nodes = [{}]
    mutate()
    expect(observeCode).toHaveBeenCalledWith(nodes[0])
    intersect([{ isIntersecting: false }])
    expect(requestIdleCallback).not.toHaveBeenCalled()
    intersect([{ isIntersecting: true }])
    expect(requestIdleCallback).toHaveBeenCalledOnce()
    expect(disconnectVisibility).toHaveBeenCalled()
    expect(disconnectMutations).toHaveBeenCalled()
    idleCallback!()
    expect(appendChild).toHaveBeenCalledOnce()
    intersect([{ isIntersecting: true }])
    expect(requestIdleCallback).toHaveBeenCalledOnce()
  })
  it('cancels code observation before a pending visibility callback arrives', () => {
    Object.assign(document, { readyState: 'complete', body: {}, querySelectorAll: () => [{}] })
    let intersect!: (entries: { isIntersecting: boolean }[]) => void
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof intersect) { intersect = callback }
      observe = vi.fn()
      disconnect = disconnect
    })
    vi.stubGlobal('MutationObserver', class { observe = vi.fn(); disconnect = disconnect })
    DeferredFonts({ href: '/fonts/mono.css', selector: 'pre' })
    hooks.cleanup!()
    intersect([{ isIntersecting: true }])
    expect(disconnect).toHaveBeenCalled()
    expect(requestIdleCallback).not.toHaveBeenCalled()
    expect(appendChild).not.toHaveBeenCalled()
    hooks.cleanup = undefined
  })
})
