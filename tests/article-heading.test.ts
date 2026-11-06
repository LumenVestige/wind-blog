import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { ArticleHeading, ArticleHeadingMotion, type ArticleHeadingEntrance } from '@/components/blog/article-heading'
import { MizukiArticleCard } from '@/components/blog/article-card-surface'
import { MizukiArticleHeader } from '@/components/blog/article-header'

vi.mock('@/components/blog/blog-navigation', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => createElement('a', { href }, children),
}))

let root: import('react-dom/client').Root | undefined
let now = 1000
let reduced = false
let changeMotion: (() => void) | undefined
const animate = vi.fn(() => ({ cancel: vi.fn(), currentTime: 0 }))
const clock: ArticleHeadingEntrance = { pathname: '/one', startedAt: 1000, title: 'One' }
const page = (key: string, entrance: ArticleHeadingEntrance | null = clock) =>
  createElement(ArticleHeadingMotion.Provider, { value: entrance },
    createElement(ArticleHeading, { key, title: 'One', pathname: '/one' }))

beforeEach(() => {
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(dom.HTMLElement.prototype, 'animate', { configurable: true, value: animate })
  Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: () => ({
    get matches() { return reduced },
    addEventListener(_event: string, callback: () => void) { changeMotion = callback },
    removeEventListener() { changeMotion = undefined },
  }) })
  now = 1000
  reduced = false
  animate.mockClear()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(async () => {
  if (root) await act(() => root!.unmount())
  root = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('continues an unfinished preview title and never replays a completed title on body arrival', async () => {
  const { createRoot } = await import('react-dom/client')
  now = 1050
  await act(() => { root = createRoot(document.getElementById('root')!); root.render(page('preview')) })
  expect(animate.mock.results[0].value.currentTime).toBe(50)
  now = 1170
  await act(() => root!.render(page('ready')))
  expect(animate.mock.results[0].value.cancel).toHaveBeenCalledOnce()
  expect(animate.mock.results[1].value.currentTime).toBe(170)
  await act(() => root!.render(page('ready')))
  expect(animate).toHaveBeenCalledTimes(2)
  now = 1500
  await act(() => root!.render(page('late-body')))
  expect(animate).toHaveBeenCalledTimes(2)
})

it('keeps the direct SSR title visible during hydration', async () => {
  const container = document.getElementById('root')!
  container.innerHTML = renderToString(page('direct', null))
  const title = container.querySelector('h1')
  const { hydrateRoot } = await import('react-dom/client')
  await act(() => { root = hydrateRoot(container, page('direct', null)) })
  expect(container.querySelector('h1')).toBe(title)
  expect(animate).not.toHaveBeenCalled()
})

it('animates a late title that was unknown to the preview, independently of the old clock', async () => {
  const { createRoot } = await import('react-dom/client')
  now = 2000
  await act(() => { root = createRoot(document.getElementById('root')!); root.render(page('unknown', { ...clock, title: undefined })) })
  expect(animate.mock.results[0].value.currentTime).toBe(0)
  reduced = true
  changeMotion!()
  expect(animate.mock.results[0].value.cancel).toHaveBeenCalledOnce()
})

it('animates the backdrop and ready metadata separately without fading their shared article ancestor', async () => {
  const article = { slug: 'one', title: 'One', publishedLabel: 'Today', publishedAt: 1,
    categoryName: 'Default', tags: [], viewCount: 1, likeCount: 0 }
  const render = (key: string, loading: boolean, views = 1) => createElement(ArticleHeadingMotion.Provider, { value: clock },
    createElement(MizukiArticleCard, { key, pathname: '/one', loading },
      createElement(MizukiArticleHeader, { article: { ...article, viewCount: views }, loading })))
  const { createRoot } = await import('react-dom/client')
  now = 1100
  await act(() => { root = createRoot(document.getElementById('root')!); root.render(render('preview', true)) })
  expect(animate.mock.instances.some(node => (node as HTMLElement).classList.contains('mz-article-backdrop'))).toBe(true)
  expect(animate.mock.instances.some(node => (node as HTMLElement).classList.contains('mz-article-info'))).toBe(false)
  now = 1250
  await act(() => root!.render(render('ready', false)))
  const info = document.querySelector('.mz-article-info')
  const metadata = animate.mock.instances.findIndex(node => node === info)
  expect(metadata).toBeGreaterThanOrEqual(0)
  expect(animate.mock.results[metadata].value.currentTime).toBe(0)
  expect(animate.mock.instances).not.toContain(document.querySelector('article'))
  const count = animate.mock.calls.length
  await act(() => root!.render(render('ready', false, 2)))
  expect(animate).toHaveBeenCalledTimes(count)
  now = 1600
  animate.mockClear()
  await act(() => root!.render(render('late-ready', false)))
  expect(animate.mock.instances).toEqual([document.querySelector('.mz-article-info')])
})
