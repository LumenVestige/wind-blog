import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { parseHTML } from 'linkedom'
import { installBlogHistory } from './helpers/blog-history'
import type { BlogPageResponse } from '@/lib/blog-page'

// Match the React renderer used by production Next, including HTML subtree reuse.
vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  return createRequire(import.meta.url)('next/dist/compiled/react')
})
vi.mock('react-dom', async () => {
  const { createRequire } = await import('node:module')
  return createRequire(import.meta.url)('next/dist/compiled/react-dom')
})
vi.mock('react-dom/client', async () => {
  const { createRequire } = await import('node:module')
  return createRequire(import.meta.url)('next/dist/compiled/react-dom/client')
})
vi.mock('next/navigation', () => ({ usePathname: () => '/', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/blog-page-client', () => ({ loadBlogPage: vi.fn(), forgetBlogPage: vi.fn() }))
vi.mock('@/lib/article-resource-warmup', () => ({
  warmPageLoadingResources: async () => ({ PageLoadingFrame: () => null }),
  warmArticleResources: async () => ({}),
}))
vi.mock('viewerjs', () => ({ default: vi.fn() }))
vi.mock('@/lib/markdown-code-copy', () => ({ bindMarkdownCodeCopy: () => () => {} }))
vi.mock('@/lib/markdown-mermaid', () => ({ bindMarkdownMermaid: async () => {} }))
vi.mock('@/lib/image-viewer-zoom', () => ({ bindImageViewerZoom: () => () => {} }))
vi.mock('@/components/blog/blog-page-view', async () => {
  const { createElement } = await import('react')
  const { MarkdownView } = await import('@/components/blog/markdown-view')
  return { BlogPageView: ({ data }: { data: { title: string; html: string } }) =>
    createElement('article', { key: data.title, className: 'mz-article' }, createElement('header', null, createElement('h1', null, data.title)),
      createElement('div', { id: 'article-body' }, createElement(MarkdownView, { html: data.html, animateEntrance: true }))) }
})

import { loadBlogPage } from '@/lib/blog-page-client'
import { ARTICLE_ENTRANCE_EVENT } from '@/lib/blog-motion-events'
import { BlogNavigationProvider, BlogPageContent, useBlogRouter } from '@/components/blog/blog-navigation'

let root: import('react-dom/client').Root | undefined
let router: ReturnType<typeof useBlogRouter>
let browserHistory: ReturnType<typeof installBlogHistory>
let scrollY: number
let motions: { element: HTMLElement; finish: () => void; cancel: ReturnType<typeof vi.fn> }[]
let requests: { href: string; resolve: (page: BlogPageResponse) => void }[]
const html = '<p data-top="300">First paragraph</p><p data-top="380">Second paragraph</p><p data-top="460">Third paragraph</p>'
const response = (href: string): BlogPageResponse => ({ href, title: href, page: { kind: 'page', title: href, html } })
function Driver() { router = useBlogRouter(); return null }

beforeEach(() => {
  vi.useFakeTimers()
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window); vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement); vi.stubGlobal('Element', dom.Element)
  vi.stubGlobal('Event', dom.window.Event); vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
  vi.stubGlobal('location', new URL('http://localhost/'))
  vi.stubGlobal('navigator', { userAgent: 'test' })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('getComputedStyle', () => ({ opacity: '1', translate: 'none' }))
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  browserHistory = installBlogHistory()
  scrollY = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  vi.stubGlobal('scrollTo', vi.fn(({ top }: { top?: number }) => { if (top !== undefined) scrollY = top }))
  motions = []; requests = []
  vi.mocked(loadBlogPage).mockReset().mockImplementation((href) => new Promise((resolve) => requests.push({ href, resolve })))
  Object.defineProperty(dom.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: function (this: HTMLElement) {
    const top = Number(this.getAttribute('data-top') || 0) - scrollY
    return { top, bottom: top + 60, left: 0, right: 600, width: 600, height: 60 }
  } })
  Object.defineProperty(dom.HTMLElement.prototype, 'animate', { configurable: true, value: function (this: HTMLElement) {
    let finish!: () => void
    const finished = new Promise<void>((resolve) => { finish = resolve })
    const cancel = vi.fn()
    motions.push({ element: this, finish, cancel })
    return { finished, cancel }
  } })
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  vi.useRealTimers(); vi.unstubAllGlobals()
})
async function mount() {
  const { createRoot } = await import('react-dom/client')
  await act(async () => {
    root = createRoot(document.getElementById('root')!)
    root.render(createElement(BlogNavigationProvider, null, createElement(Driver),
      createElement('div', { className: 'mz-shell' }, createElement('main', { className: 'mz-content' },
        createElement(BlogPageContent, null, 'SSR home')), createElement('aside', { className: 'mz-sidebar' }, 'Sidebar'))))
  })
}
async function commit(href: string, responseFirst: boolean) {
  const before = motions.length
  const index = requests.length
  await act(async () => router.push(href))
  const exit = motions.slice(before).find((motion) => motion.element.classList.contains('blog-page-transition'))!
  const reply = async () => { await act(async () => requests[index].resolve(response(href))) }
  if (responseFirst) await reply()
  await act(async () => exit.finish())
  if (!responseFirst) await reply()
}
function bodyMotions() { return motions.filter((motion) => motion.element.closest('#article-body') && motion.element.isConnected) }

describe('article body entrance in real JSON route commits', () => {
  it.each([true, false].flatMap((responseFirst) => [0, 1600, 5000].map((fromScroll) => ({ responseFirst, fromScroll }))))(
    'animates the visible body after scroll reset (cached=$responseFirst, previous scroll=$fromScroll)', async ({ responseFirst, fromScroll }) => {
      await mount()
      scrollY = fromScroll
      await commit('/one', responseFirst)
      expect(scrollY).toBe(0)
      expect(bodyMotions()).toHaveLength(3)
      expect(bodyMotions().map((motion) => motion.element.textContent)).toEqual(['First paragraph', 'Second paragraph', 'Third paragraph'])
      window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
      expect(bodyMotions()).toHaveLength(3)
    },
  )

  it('restores scroll and clears history restoration before starting body entrance', async () => {
    await mount()
    await commit('/one', true)
    scrollY = 120
    await commit('/two', false)
    const before = motions.length
    await act(async () => browserHistory.go(-1))
    const exit = motions.slice(before).find((motion) => motion.element.classList.contains('blog-page-transition'))!
    await act(async () => exit.finish())
    await act(async () => requests[2].resolve(response('/one')))
    expect(location.pathname).toBe('/one')
    expect(scrollY).toBe(120)
    expect(bodyMotions()).toHaveLength(3)
    expect(document.querySelector('.mz-shell')?.hasAttribute('data-blog-restoring')).toBe(false)
  })

  it('plays the same article on every revisit with alternating response timing', async () => {
    await mount()
    for (let index = 0; index < 8; index++) {
      scrollY = index % 2 ? 1800 : 0
      await commit(index % 2 ? '/two' : '/one', index % 3 === 0)
      expect(bodyMotions()).toHaveLength(3)
      expect(bodyMotions().every((motion) => motion.cancel.mock.calls.length === 0)).toBe(true)
    }
  })
})
