import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import type { ArticlePayload } from '@/lib/article-prefetch'

const requests = vi.hoisted(() => ({ take: vi.fn(), load: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'one' }) }))
vi.mock('@/lib/article-prefetch', () => ({ takeArticleNavigation: requests.take, loadArticleForReading: requests.load }))
vi.mock('@/lib/markdown', () => ({ renderMarkdown: (content: string) => content, extractHeadings: () => [] }))
vi.mock('@/components/blog/article-link', () => ({ readArticlePreview: () => null }))
vi.mock('@/components/blog/article-nav', () => ({ ArticleNav: () => null, ArticleNavSkeleton: () => null }))
vi.mock('@/components/blog/article-view', () => ({
  ArticleView: ({ article, loading, bodySlot }: { article: { title: string }; loading: boolean; bodySlot: React.ReactNode }) =>
    createElement('article', { 'data-loading': String(loading) }, createElement('h1', null, article.title), bodySlot),
  ArticleBodyContent: ({ html }: { html: string }) => createElement('div', { id: 'article-body' }, html),
}))

import { InstantArticle } from '@/components/blog/instant-article'

const article: ArticlePayload = {
  id: 1, slug: 'one', username: 'owner', userId: 1, title: 'Ready title', summary: '', content: 'Ready body',
  tags: [], categoryId: null, createdAt: 1, publishedAt: 1, updatedAt: 1,
  viewCount: 4, likeCount: 0, liked: false, commentCount: 0, requiresPassword: false,
}
let root: import('react-dom/client').Root | undefined
const page = () => createElement(StrictMode, null, createElement(InstantArticle, {
  themeId: 'mizuki', username: 'owner', categoryName: '',
}))

beforeEach(() => {
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  requests.take.mockReset()
  requests.load.mockReset()
})
afterEach(async () => {
  if (root) await act(() => root!.unmount())
  root = undefined
  vi.unstubAllGlobals()
})

describe('article navigation handoff', () => {
  it('keeps direct SSR deterministic without consuming browser navigation data', () => {
    const html = renderToString(page())
    expect(html).toContain('正文加载中')
    expect(requests.take).not.toHaveBeenCalled()
    expect(requests.load).not.toHaveBeenCalled()
  })

  it('commits a prefetched heading and body together and reuses the read in Strict Mode', async () => {
    const promise = Promise.resolve(article)
    requests.take.mockReturnValueOnce({ data: article, promise })
    const { createRoot } = await import('react-dom/client')
    await act(async () => { root = createRoot(document.getElementById('root')!); root.render(page()); await promise })
    expect(document.querySelector('h1')?.textContent).toBe('Ready title')
    expect(document.getElementById('article-body')?.textContent).toBe('Ready body')
    expect(document.querySelector('article')?.getAttribute('data-loading')).toBe('false')
    expect(document.querySelector('.mz-article-skeleton')).toBeNull()
    expect(requests.take).toHaveBeenCalledTimes(1)
    expect(requests.load).not.toHaveBeenCalled()
  })

  it('waits only for an unfinished prefetch without a duplicate request', async () => {
    let resolve!: (data: ArticlePayload) => void
    const promise = new Promise<ArticlePayload>((done) => { resolve = done })
    requests.take.mockReturnValueOnce({ data: null, promise })
    const { createRoot } = await import('react-dom/client')
    await act(() => { root = createRoot(document.getElementById('root')!); root.render(page()) })
    expect(document.getElementById('article-body')).toBeNull()
    expect(document.querySelector('.mz-article-skeleton')).not.toBeNull()
    await act(async () => { resolve(article); await promise })
    expect(document.getElementById('article-body')?.textContent).toBe('Ready body')
    expect(requests.load).not.toHaveBeenCalled()
    expect(requests.take).toHaveBeenCalledTimes(1)
  })
})
