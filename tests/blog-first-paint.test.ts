import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { parseHTML } from 'linkedom'

const route = vi.hoisted(() => ({ pathname: '/', search: '' }))
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.search),
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))
import { BlogNavigationProvider } from '@/components/blog/blog-navigation'
import { PageLoadingFrame } from '@/components/blog/page-loading'
import { isArticlePathname } from '@/lib/blog-route'

let root: import('react-dom/client').Root | undefined
let animate: ReturnType<typeof vi.fn>

beforeEach(() => {
  route.pathname = '/'
  route.search = ''
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('Event', dom.window.Event)
  vi.stubGlobal('location', new URL('http://localhost/'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  animate = vi.fn(() => ({ cancel: vi.fn() }))
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  Object.defineProperty(dom.HTMLElement.prototype, 'animate', { configurable: true, value: animate })
})
afterEach(async () => {
  if (root) await act(() => root!.unmount())
  root = undefined
  delete (HTMLElement.prototype as { animate?: unknown }).animate
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function page(strict = false) {
  const tree = createElement(BlogNavigationProvider, null,
    createElement('div', { className: 'mz-shell' },
      createElement('main', { className: 'mz-content' },
        createElement('div', { 'data-feed-list': '' }, 'Articles already rendered by the server')),
      createElement('aside', { className: 'mz-sidebar' }, 'Sidebar')))
  return strict ? createElement(StrictMode, null, tree) : tree
}

describe('blog first paint', () => {
  it.each([false, true])('keeps SSR content visible during hydration (Strict Mode: %s)', async (strict) => {
    const container = document.getElementById('root')!
    container.innerHTML = renderToString(page(strict))
    const content = container.querySelector('main')
    const { hydrateRoot } = await import('react-dom/client')
    await act(() => { root = hydrateRoot(container, page(strict)) })
    expect(container.querySelector('main')).toBe(content)
    expect(animate).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(container.querySelector('.mz-shell')?.hasAttribute('data-blog-transitions')).toBe(false)

    // A subsequent in-site route commit still animates, without replaying on
    // unrelated renders or on Strict Mode's repeated effect setup.
    route.pathname = '/archives'
    location.pathname = '/archives'
    await act(() => root!.render(page(strict)))
    expect(animate).toHaveBeenCalledTimes(2)
    expect(container.querySelector('.mz-shell')?.hasAttribute('data-blog-transitions')).toBe(true)
    await act(() => root!.render(page(strict)))
    expect(animate).toHaveBeenCalledTimes(2)
  })

  it('retains list-only transitions for query changes after the first paint', async () => {
    const { createRoot } = await import('react-dom/client')
    await act(() => { root = createRoot(document.getElementById('root')!); root.render(page()) })
    expect(animate).not.toHaveBeenCalled()
    route.search = 'sort=hot'
    await act(() => root!.render(page()))
    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.instances[0]).toBe(document.querySelector('[data-feed-list]'))
  })

  it('does not fade the entire content area on top of an article entrance', async () => {
    const articlePage = () => createElement(BlogNavigationProvider, null,
      createElement('div', { className: 'mz-shell' },
        createElement('main', { className: 'mz-content' },
          createElement('article', { className: 'mz-article' }, createElement('header', null, 'Ready article'))),
        createElement('aside', { className: 'mz-sidebar' }, 'Outline')))
    const { createRoot } = await import('react-dom/client')
    await act(() => { root = createRoot(document.getElementById('root')!); root.render(articlePage()) })
    route.pathname = '/article'
    location.pathname = '/article'
    await act(() => root!.render(articlePage()))
    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.instances[0]).toBe(document.querySelector('.mz-sidebar'))
    expect(animate.mock.instances).not.toContain(document.querySelector('.mz-content'))
  })

  it('renders destination-appropriate placeholders when navigation requests a frame', () => {
    const home = renderToString(createElement(PageLoadingFrame, { pathname: '/' }))
    expect(home).toContain('aria-busy="true"')
    expect(home.match(/class="mz-feed-card"/g)).toHaveLength(6)
    const article = renderToString(createElement(PageLoadingFrame, { pathname: '/agent-part-1' }))
    expect(article).toContain('mz-skeleton-title')
    expect(article).not.toContain('mz-feed-card')
    expect(isArticlePathname('/archives')).toBe(false)
    expect(isArticlePathname('/p/contact')).toBe(false)
  })
})
