import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { parseHTML } from 'linkedom'

// Exercise the React DOM bundled by Next, whose innerHTML update behavior
// differs from the standalone React version used by the other unit tests.
vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  return createRequire(import.meta.url)('next/dist/compiled/react')
})
vi.mock('react-dom/client', async () => {
  const { createRequire } = await import('node:module')
  return createRequire(import.meta.url)('next/dist/compiled/react-dom/client')
})

const motion = vi.hoisted(() => ({ bind: vi.fn(), cleanup: vi.fn() }))
vi.mock('@/lib/article-block-motion', () => ({ bindArticleBlockMotion: motion.bind }))

vi.mock('viewerjs', () => ({ default: vi.fn() }))
vi.mock('@/lib/markdown-code-copy', () => ({ bindMarkdownCodeCopy: () => () => {} }))
vi.mock('@/lib/markdown-mermaid', () => ({ bindMarkdownMermaid: async () => {} }))
vi.mock('@/lib/image-viewer-zoom', () => ({ bindImageViewerZoom: () => () => {} }))

import { MarkdownView } from '@/components/blog/markdown-view'

let root: import('react-dom/client').Root | undefined
beforeEach(() => {
  const dom = parseHTML('<html><body><div id="root"></div></body></html>')
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  motion.bind.mockReset().mockReturnValue(motion.cleanup)
  motion.cleanup.mockReset()
})
afterEach(async () => {
  if (root) await act(() => root!.unmount())
  root = undefined
  vi.unstubAllGlobals()
})

it('preserves animated body nodes on metadata updates, but replaces changed content', async () => {
  const { createRoot } = await import('react-dom/client')
  const html = '<h2>Heading</h2><p>Paragraph</p><hr><pre>Code</pre>'
  const render = (views: number, body = html) => createElement('article', null,
    createElement('h1', null, 'Stable title'), createElement('span', null, views),
    createElement(MarkdownView, { html: body, animateEntrance: true }))
  const container = document.getElementById('root')!
  await act(() => { root = createRoot(container); root.render(render(1)) })
  const blocks = [...container.querySelector('.markdown-body')!.children]
  const title = container.querySelector('h1')
  expect(motion.bind).toHaveBeenCalledExactlyOnceWith(container.querySelector('.markdown-body'))
  await act(() => root!.render(render(2)))
  expect(container.querySelector('span')?.textContent).toBe('2')
  expect(motion.bind).toHaveBeenCalledTimes(1)
  expect(motion.cleanup).not.toHaveBeenCalled()
  for (const [index, block] of blocks.entries()) {
    expect(container.querySelector('.markdown-body')!.children[index]).toBe(block)
  }
  // A presentation-only prop change must also preserve the HTML subtree.
  await act(() => root!.render(createElement('article', null,
    createElement('h1', null, 'Stable title'), createElement('span', null, 2),
    createElement(MarkdownView, { html, animateEntrance: true, className: 'updated' }))))
  expect(container.querySelector('.markdown-body')!.firstElementChild).toBe(blocks[0])
  await act(() => root!.render(render(3, '<p>Edited body</p>')))
  expect(container.querySelector('.markdown-body')?.textContent).toBe('Edited body')
  expect(blocks.every(block => !block.isConnected)).toBe(true)
  expect(motion.cleanup).toHaveBeenCalledOnce()
  expect(motion.bind).toHaveBeenCalledTimes(2)
  expect(container.querySelector('h1')).toBe(title)
})
