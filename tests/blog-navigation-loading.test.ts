import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, type ReactNode } from 'react'
import { parseHTML } from 'linkedom'

const route = vi.hoisted(() => ({ pathname: '/', search: '' }))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useSearchParams: () => new URLSearchParams(route.search), useRouter: () => router }))
vi.mock('@/lib/article-prefetch', () => ({ clearArticlePrefetch: vi.fn(), canPrefetchArticle: () => true, createArticleIntent: vi.fn(), prefetchArticle: vi.fn(), prepareArticleForNavigation: vi.fn() }))
vi.mock('@/lib/article-preview', () => ({ readArticlePreview: (slug: string) => ({ slug, title: `Title ${slug}` }), saveArticlePreview: vi.fn() }))
vi.mock('@/lib/article-resource-warmup', () => ({
  warmArticleResources: vi.fn(),
  warmPageLoadingResources: vi.fn(async () => ({
    PageLoadingFrame: ({ pathname, preview }: { pathname: string; preview?: { title: string } }) =>
      createElement('article', { className: 'mz-article', role: 'status', 'data-destination': pathname },
        createElement('header', null, createElement('h1', null, preview?.title || 'Page loading')),
        createElement('div', { className: 'mz-article-skeleton' }, 'Loading body')),
  })),
}))

import { BlogNavigationProvider, BlogPageContent, useBlogRouter } from '@/components/blog/blog-navigation'

let root: import('react-dom/client').Root | undefined
let navigate: ReturnType<typeof useBlogRouter>['push']
let motions: { finish: () => void; cancel: ReturnType<typeof vi.fn>; element: HTMLElement }[]
let reduced: boolean

function Driver() { navigate = useBlogRouter().push; return null }
function page(body: ReactNode = 'Original page') {
  return createElement(BlogNavigationProvider, null,
    createElement(Driver),
    createElement('div', { className: 'mz-shell' },
      createElement('main', { className: 'mz-content' }, createElement(BlogPageContent, null, body)),
      createElement('aside', { className: 'mz-sidebar' }, 'Sidebar')))
}

beforeEach(() => {
  vi.useFakeTimers()
  route.pathname = '/'
  route.search = ''
  router.push.mockClear(); router.replace.mockClear(); router.prefetch.mockClear()
  motions = []
  reduced = false
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  vi.stubGlobal('Event', dom.window.Event)
  vi.stubGlobal('location', new URL('http://localhost/'))
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function mount() {
  const { createRoot } = await import('react-dom/client')
  await act(() => { root = createRoot(document.getElementById('root')!); root.render(page()) })
}

describe('route loading and exit animation handoff', () => {
  it('starts routing on the click and shows a title/skeleton immediately when the exit finishes first', async () => {
    await mount()
    await act(() => navigate('/one'))
    expect(router.push).toHaveBeenCalledExactlyOnceWith('/one', { scroll: undefined })
    expect(document.querySelector('.mz-navigation-underlay')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(false)
    const exit = motions[0]
    expect(exit.element).not.toBe(document.querySelector('main'))
    await act(async () => { exit.finish(); await Promise.resolve() })
    expect(document.querySelector('h1')?.textContent).toBe('Title one')
    expect(document.querySelector('.mz-article-skeleton')).not.toBeNull()
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(true)
    expect(exit.cancel).toHaveBeenCalledOnce()
    route.pathname = '/one'
    location.pathname = '/one'
    await act(() => root!.render(page(createElement('article', { className: 'mz-article' },
      createElement('header', null, createElement('h1', null, 'Title one')), createElement('p', null, 'Ready body')))))
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(false)
    expect(document.querySelector('[role="status"]')).toBeNull()
    expect(document.querySelector('h1')?.textContent).toBe('Title one')
    expect(document.querySelector('main')?.textContent).toContain('Ready body')
  })

  it('keeps a completed target ready through the remaining exit without showing an unnecessary fallback', async () => {
    await mount()
    await act(() => navigate('/archives'))
    const exit = motions[0]
    route.pathname = '/archives'; location.pathname = '/archives'
    await act(() => root!.render(page('Archives ready')))
    expect(exit.cancel).not.toHaveBeenCalled()
    await act(async () => { exit.finish(); await Promise.resolve() })
    expect(document.querySelector('[role="status"]')).toBeNull()
    expect(document.querySelector('main')?.textContent).toBe('Archives ready')
    expect(exit.cancel).toHaveBeenCalledOnce()
  })

  it.each(['/archives', '/categories', '/tags', '/p/contact', '/'])('provides a loading surface for slow navigation to %s', async (href) => {
    await mount()
    if (href === '/') { route.pathname = '/archives'; location.pathname = '/archives'; await act(() => root!.render(page())) }
    const first = motions.length
    await act(() => navigate(href))
    await act(async () => { motions[first].finish(); await Promise.resolve() })
    expect(document.querySelector('[role="status"]')).not.toBeNull()
    expect(document.querySelector('.blog-page-transition')?.hasAttribute('hidden')).toBe(true)
  })

  it('ignores an old exit completion after a second click', async () => {
    await mount()
    await act(() => navigate('/one'))
    const first = motions[0]
    await act(() => navigate('/two'))
    const second = motions[2]
    await act(async () => { first.finish(); await Promise.resolve() })
    expect(document.querySelector('.mz-navigation-underlay')?.getAttribute('aria-hidden')).toBe('true')
    await act(async () => { second.finish(); await Promise.resolve() })
    expect(document.querySelector('h1')?.textContent).toBe('Title two')
    expect(router.push).toHaveBeenCalledTimes(2)
  })

  it('immediately shows the loading surface when reduced motion bypasses the exit', async () => {
    await mount()
    reduced = true
    await act(() => navigate('/one'))
    expect(motions).toHaveLength(0)
    expect(document.querySelector('h1')?.textContent).toBe('Title one')
    expect(document.querySelector('[role="status"]')).not.toBeNull()
    expect(router.push).toHaveBeenCalledOnce()
  })
})
