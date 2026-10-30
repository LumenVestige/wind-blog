import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { parseHTML } from 'linkedom'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('@/components/blog/blog-navigation', () => ({ useBlogRouter: () => router }))
vi.mock('@/lib/api-client', async (original) => ({
  ...await original<typeof import('@/lib/api-client')>(), api: { post: vi.fn() },
}))
vi.mock('@/components/blog/article-nav', () => ({ ArticleNav: () => null }))
vi.mock('@/components/blog/article-view', () => ({
  ArticleView: ({ article, bodySlot }: { article: { title: string; viewCount: number }; bodySlot: React.ReactNode }) =>
    createElement('article', null, createElement('h1', null, article.title), createElement('span', { 'data-count': '' }, article.viewCount), bodySlot),
  ArticleBodyContent: ({ html, locked }: { html: string; locked: boolean }) => locked
    ? createElement('p', null, 'Unlock')
    : createElement('div', { id: 'article-body', dangerouslySetInnerHTML: { __html: html } }),
}))

import { api, ClientApiError } from '@/lib/api-client'
import { ArticleReader, type ArticleReaderProps } from '@/components/blog/article-reader'
const props: ArticleReaderProps = {
  themeId: 'mizuki', username: 'owner', revision: 'revision', countRead: true,
  toc: [], adjacent: { prev: null, next: null }, isOwner: false, viewerId: 0, isAdmin: false,
  article: { id: 1, slug: 'one', title: 'SSR title', content: '', html: '<p>Full <strong>SSR body</strong></p>', tags: [], categoryName: '',
    publishedLabel: 'Today', updatedAt: 1, viewCount: 3, likeCount: 0, liked: false, commentCount: 0, requiresPassword: false, userId: 1 },
}
const page = (overrides: Partial<ArticleReaderProps> = {}) => createElement(StrictMode, null, createElement(ArticleReader, { ...props, ...overrides }))
let root: import('react-dom/client').Root | undefined

beforeEach(() => {
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(api.post).mockReset().mockResolvedValue({ viewCount: 4, likeCount: 0, commentCount: 0, liked: false })
  router.refresh.mockClear()
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  vi.unstubAllGlobals()
})

describe('SSR article reader', () => {
  it('returns the full title/body in server HTML without a body request or read count', () => {
    const html = renderToString(page())
    expect(html).toContain('<strong>SSR body</strong>')
    expect(html).toContain('SSR title')
    expect(html).not.toContain('正文加载中')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('hydrates the same title/body nodes and counts once in Strict Mode', async () => {
    const container = document.getElementById('root')!
    container.innerHTML = renderToString(page())
    const title = container.querySelector('h1')
    const body = container.querySelector('#article-body')
    const { hydrateRoot } = await import('react-dom/client')
    await act(async () => { root = hydrateRoot(container, page()) })
    expect(container.querySelector('h1')).toBe(title)
    expect(container.querySelector('#article-body')).toBe(body)
    expect(container.querySelector('[data-count]')?.textContent).toBe('4')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/api/blog/article/read', { id: 1, updatedAt: 1, revision: 'revision' })
  })

  it('does not count locked or private article views', async () => {
    const { createRoot } = await import('react-dom/client')
    await act(async () => { root = createRoot(document.getElementById('root')!); root.render(page({ countRead: false })) })
    expect(api.post).not.toHaveBeenCalled()
    await act(async () => root!.render(page({ article: { ...props.article, html: '', requiresPassword: true } })))
    expect(document.getElementById('article-body')).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('refreshes revoked or edited prefetched content instead of leaving stale body visible', async () => {
    vi.mocked(api.post).mockRejectedValue(new ClientApiError('Article changed', 409, 409))
    const { createRoot } = await import('react-dom/client')
    await act(async () => { root = createRoot(document.getElementById('root')!); root.render(page()) })
    expect(document.getElementById('article-body')).toBeNull()
    expect(document.querySelector('h1')?.textContent).toBe('SSR title')
    expect(router.refresh).toHaveBeenCalledOnce()
    expect(api.post).toHaveBeenCalledOnce()
  })
})
