import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, type ReactNode } from 'react'
import { parseHTML } from 'linkedom'
import { installBlogHistory } from './helpers/blog-history'
import type { BlogPageResponse } from '@/lib/blog-page'

const route = vi.hoisted(() => ({ pathname: '/', search: '' }))
const nextRouter = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams(route.search), useRouter: () => nextRouter }))
vi.mock('@/lib/blog-page-client', () => ({ loadBlogPage: vi.fn(), forgetBlogPage: vi.fn() }))
vi.mock('@/lib/article-preview', () => ({ readArticlePreview: (slug: string) => ({ slug, title: `Title ${slug}` }), saveArticlePreview: vi.fn() }))
vi.mock('@/components/blog/blog-page-view', () => ({ BlogPageView: ({ data }: { data: { title: string; html: string } }) =>
  createElement('article', { className: 'mz-article' }, createElement('header', null, createElement('h1', null, data.title)), createElement('p', null, data.html)) }))
vi.mock('@/lib/article-resource-warmup', () => ({
  warmArticleResources: vi.fn(),
  warmPageLoadingResources: vi.fn(async () => ({
    PageLoadingFrame: ({ pathname, preview }: { pathname: string; preview?: { title: string } }) =>
      createElement('article', { className: 'mz-article', role: 'status', 'data-destination': pathname },
        createElement('header', null, createElement('h1', null, preview?.title || 'Page loading')),
        createElement('div', { className: 'mz-article-skeleton' }, 'Loading body')),
  })),
}))

import { loadBlogPage } from '@/lib/blog-page-client'
import { BlogNavigationProvider, BlogPageContent, useBlogRouter, useBlogPathname } from '@/components/blog/blog-navigation'

let root: import('react-dom/client').Root | undefined
let router: ReturnType<typeof useBlogRouter>
let browserHistory: ReturnType<typeof installBlogHistory>
let motions: { finish: () => void; cancel: ReturnType<typeof vi.fn>; element: HTMLElement }[]
let reduced: boolean
let requests: { href: string; resolve: (value: BlogPageResponse) => void; reject: (error: Error) => void }[]
const response = (href: string): BlogPageResponse => ({ href, title: `Title ${href}`, page: { kind: 'page', title: `Title ${href}`, html: `Ready body ${href}` } })

function Driver() { router = useBlogRouter(); return createElement('span', { 'data-path': '' }, useBlogPathname()) }
function page(body: ReactNode = 'Original page') {
  return createElement(BlogNavigationProvider, null, createElement(Driver),
    createElement('div', { className: 'mz-shell' },
      createElement('main', { className: 'mz-content' }, createElement(BlogPageContent, null, body)),
      createElement('aside', { className: 'mz-sidebar' }, 'Sidebar')))
}

beforeEach(() => {
  vi.useFakeTimers()
  route.pathname = '/'; route.search = ''
  Object.values(nextRouter).forEach((mock) => mock.mockClear())
  motions = []; requests = []; reduced = false
  vi.mocked(loadBlogPage).mockReset().mockImplementation((href) => new Promise((resolve, reject) => requests.push({ href, resolve, reject })))
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement); vi.stubGlobal('Element', dom.Element); vi.stubGlobal('Event', dom.window.Event)
  vi.stubGlobal('location', new URL('http://localhost/'))
  browserHistory = installBlogHistory()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('getComputedStyle', () => ({ opacity: '1', translate: 'none' }))
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced }, addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(dom.HTMLElement.prototype, 'animate', { configurable: true, value: function (this: HTMLElement) {
    let finish!: () => void
    const finished = new Promise<void>((resolve) => { finish = resolve })
    const cancel = vi.fn()
    motions.push({ finish, cancel, element: this })
    return { finished, cancel }
  } })
})
afterEach(async () => {
  if (root) await act(() => root!.unmount())
  root = undefined
  for (const mock of Object.values(nextRouter)) expect(mock).not.toHaveBeenCalled()
  vi.useRealTimers(); vi.unstubAllGlobals()
})
async function mount(body?: ReactNode) {
  const { createRoot } = await import('react-dom/client')
  await act(() => { root = createRoot(document.getElementById('root')!); root.render(page(body)) })
}
async function finishExit(index = 0) { await act(async () => { motions[index].finish() }) }
async function ready(index = 0) { await act(async () => { requests[index].resolve(response(requests[index].href)) }) }

describe('JSON navigation and exit animation handoff', () => {
  it('starts the JSON request on click, shows a loading frame after exit and commits client content when ready', async () => {
    await mount()
    expect(requests).toHaveLength(0)
    await act(() => router.push('/one'))
    expect(requests.map((request) => request.href)).toEqual(['/one'])
    expect(browserHistory.pushState).not.toHaveBeenCalled()
    expect(document.querySelector('.mz-navigation-underlay')?.getAttribute('aria-hidden')).toBe('true')
    await finishExit()
    expect(document.querySelector('h1')?.textContent).toBe('Title one')
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(true)
    expect(motions[0].cancel).not.toHaveBeenCalled()
    await ready()
    expect(location.pathname).toBe('/one')
    expect(document.querySelector('[data-path]')?.textContent).toBe('/one')
    expect(document.title).toBe('Title /one')
    expect(document.querySelector('.blog-page-transition')?.textContent).toContain('Ready body /one')
    expect(document.querySelector('[role="status"]')).toBeNull()
    expect(motions[0].cancel).toHaveBeenCalledOnce()
  })

  it('holds a prefetched/fast response until exit completes and does not fade the article parent', async () => {
    await mount()
    await act(() => router.push('/one'))
    await ready()
    expect(document.querySelector('.blog-page-transition')?.textContent).toBe('Original page')
    expect(browserHistory.pushState).not.toHaveBeenCalled()
    await finishExit()
    expect(document.querySelector('[role="status"]')).toBeNull()
    expect(document.querySelector('main')?.textContent).toContain('Ready body /one')
    // Exit + sidebar exit + sidebar entrance; no page opacity above article blocks.
    expect(motions.map((motion) => motion.element)).not.toContain(document.querySelector('main'))
    expect(motions).toHaveLength(3)
  })

  it.each(['/archives', '/categories', '/tags', '/p/contact', '/'])('provides a loading surface for slow navigation to %s', async (href) => {
    if (href === '/') { route.pathname = '/archives'; location.pathname = '/archives' }
    await mount()
    await act(() => router.push(href))
    await finishExit()
    expect(document.querySelector('[role="status"]')).not.toBeNull()
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(true)
  })

  it('ignores an old exit and response after a second click', async () => {
    await mount()
    await act(() => router.push('/one'))
    await act(() => router.push('/two'))
    await ready(0); await finishExit(0)
    expect(browserHistory.pushState).not.toHaveBeenCalled()
    await finishExit(2); await ready(1)
    expect(location.pathname).toBe('/two')
    expect(document.querySelector('main')?.textContent).toContain('Ready body /two')
    expect(browserHistory.pushState).toHaveBeenCalledOnce()
  })

  it('keeps feed tabs and the search toolbar mounted while a slow query change loads', async () => {
    await mount(createElement('section', null, createElement('nav', null, 'Latest / Hot'), createElement('input'), createElement('div', { 'data-feed-list': '' }, 'Feed')))
    const tabs = document.querySelector('nav'), search = document.querySelector('input')
    await act(() => router.push('/?sort=hot', { scroll: false }))
    expect(motions[0].element).toBe(document.querySelector('[data-feed-list]'))
    await finishExit()
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(false)
    expect(document.querySelector('nav')).toBe(tabs); expect(document.querySelector('input')).toBe(search)
    await ready()
    expect(location.search).toBe('?sort=hot')
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('shows loading immediately for reduced motion, then renders JSON without animation', async () => {
    await mount(); reduced = true
    await act(() => router.push('/one'))
    expect(motions).toHaveLength(0)
    expect(document.querySelector('[role="status"]')).not.toBeNull()
    await ready()
    expect(location.pathname).toBe('/one'); expect(motions).toHaveLength(0)
  })

  it('loads history traversal and refresh through JSON and restores the matching URL', async () => {
    await mount(); reduced = true
    await act(() => router.push('/one')); await ready()
    await act(() => router.push('/two')); await ready(1)
    const nextPop = vi.fn()
    window.addEventListener('popstate', nextPop)
    await act(() => browserHistory.go(-1)); await ready(2)
    expect(loadBlogPage).toHaveBeenLastCalledWith('/one', true)
    expect(document.querySelector('main')?.textContent).toContain('Ready body /one')
    expect(nextPop).not.toHaveBeenCalled()
    await act(() => router.refresh()); await ready(3)
    expect(loadBlogPage).toHaveBeenLastCalledWith('/one', true)
    expect(browserHistory.pushState).toHaveBeenCalledTimes(2)
  })

  it('shows a retryable JSON failure and ignores a superseded request', async () => {
    await mount(); reduced = true
    await act(() => router.push('/one'))
    await act(async () => requests[0].reject(new Error('文章不存在')))
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('文章不存在')
    expect(document.querySelector('[role="status"]')).toBeNull()
    expect(location.pathname).toBe('/one')
    await act(() => router.refresh()); await ready(1)
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(document.querySelector('main')?.textContent).toContain('Ready body /one')
  })
})
