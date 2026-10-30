import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { installBlogHistory } from './helpers/blog-history'
import type { BlogPageResponse } from '@/lib/blog-page'

vi.mock('next/navigation', () => ({ usePathname: () => '/', useSearchParams: () => new URLSearchParams(), useRouter: () => { throw new Error('Next router must not be used') } }))
vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn() } }))
vi.mock('@/lib/article-resource-warmup', () => ({
  warmArticleResources: vi.fn(async () => ({})),
  warmPageLoadingResources: vi.fn(async () => ({ PageLoadingFrame: () => null })),
}))
vi.mock('@/components/blog/blog-page-view', () => ({ BlogPageView: ({ data }: { data: { title: string } }) => createElement('article', null, data.title) }))

import { api } from '@/lib/api-client'
import { forgetBlogPage, loadBlogPage } from '@/lib/blog-page-client'
import { warmArticleResources } from '@/lib/article-resource-warmup'
import BlogLink, { BlogNavigationProvider, BlogPageContent } from '@/components/blog/blog-navigation'
let root: import('react-dom/client').Root | undefined
const href = '/json-prefetch-article'
const response: BlogPageResponse = { href, title: 'JSON article', page: { kind: 'page', title: 'JSON article', html: '<p>Ready body</p>' } }

beforeEach(() => {
  vi.useFakeTimers()
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement); vi.stubGlobal('Element', dom.Element); vi.stubGlobal('Event', dom.window.Event)
  vi.stubGlobal('location', new URL('http://localhost/'))
  vi.stubGlobal('navigator', { userAgent: 'test', connection: { effectiveType: '4g' } })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('getComputedStyle', () => ({ opacity: '1', translate: 'none' }))
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  installBlogHistory()
  forgetBlogPage(href)
  vi.mocked(api.get).mockReset().mockResolvedValue(response)
  vi.mocked(warmArticleResources).mockClear()
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined; forgetBlogPage(href)
  vi.useRealTimers(); vi.unstubAllGlobals()
})
async function mount() {
  const { createRoot } = await import('react-dom/client')
  await act(async () => {
    root = createRoot(document.getElementById('root')!)
    root.render(createElement(BlogNavigationProvider, null,
      createElement('div', { className: 'mz-shell' },
        createElement(BlogLink, { href, articleSlug: href.slice(1) }, 'Open article'),
        createElement('main', { className: 'mz-content' }, createElement(BlogPageContent, null, 'SSR content')))))
  })
}
function dispatch(type: string, properties: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { button: 0, pointerType: 'mouse', ...properties })
  document.querySelector('a')!.dispatchEvent(event)
  return event
}

describe('article prefetch connected to JSON navigation', () => {
  it('prefetches on a 200ms hover, warms reading resources and reuses the JSON on click', async () => {
    await mount()
    await act(async () => dispatch('pointerover'))
    await act(async () => vi.advanceTimersByTime(199))
    expect(api.get).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/blog/page', { href })
    expect(warmArticleResources).toHaveBeenCalledOnce()
    await act(async () => dispatch('click'))
    expect(api.get).toHaveBeenCalledOnce()
    expect(location.pathname).toBe(href)
    expect(document.querySelector('main')?.textContent).toBe('JSON article')
  })

  it('cancels a passing hover and respects data saver for speculation', async () => {
    await mount()
    await act(async () => dispatch('pointerover'))
    await act(async () => vi.advanceTimersByTime(100))
    await act(async () => dispatch('pointerout'))
    await act(async () => vi.advanceTimersByTime(200))
    expect(api.get).not.toHaveBeenCalled()
    vi.stubGlobal('navigator', { userAgent: 'test', connection: { saveData: true } })
    await act(async () => dispatch('focusin'))
    await act(async () => vi.advanceTimersByTime(200))
    expect(api.get).not.toHaveBeenCalled()
    await act(async () => dispatch('click'))
    expect(api.get).toHaveBeenCalledOnce()
  })

  it('prefetches for keyboard focus and immediately on pointer down, without a duplicate click request', async () => {
    await mount()
    await act(async () => dispatch('focusin'))
    await act(async () => vi.advanceTimersByTime(200))
    expect(api.get).toHaveBeenCalledOnce()
    await act(async () => dispatch('pointerdown'))
    await act(async () => dispatch('click'))
    expect(api.get).toHaveBeenCalledOnce()
  })

  it('shares an in-flight prefetch with a click and renders when that one request finishes', async () => {
    let resolve!: (page: BlogPageResponse) => void
    vi.mocked(api.get).mockImplementation(() => new Promise((done) => { resolve = done }))
    await mount()
    await act(async () => dispatch('pointerdown'))
    await act(async () => dispatch('click'))
    expect(api.get).toHaveBeenCalledOnce()
    expect(location.pathname).toBe('/')
    await act(async () => { resolve(response) })
    expect(location.pathname).toBe(href)
    expect(document.querySelector('main')?.textContent).toBe('JSON article')
  })

  it('keeps modifier clicks native', async () => {
    await mount()
    let event!: Event
    await act(async () => { event = dispatch('click', { ctrlKey: true }) })
    expect(event.defaultPrevented).toBe(false)
    expect(api.get).not.toHaveBeenCalled()
    expect(location.pathname).toBe('/')
  })

  it('expires prefetched data, rechecks forced refreshes and retries failed prefetches', async () => {
    const first = loadBlogPage(href)
    expect(loadBlogPage(href)).toBe(first)
    await first
    await loadBlogPage(href, true)
    expect(api.get).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(30_001)
    await loadBlogPage(href)
    expect(api.get).toHaveBeenCalledTimes(3)
    forgetBlogPage(href)
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))
    await expect(loadBlogPage(href)).rejects.toThrow('Network error')
    await expect(loadBlogPage(href)).resolves.toEqual(response)
    expect(api.get).toHaveBeenCalledTimes(5)
  })
})
