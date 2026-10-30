import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const markdown = vi.hoisted(() => ({ render: vi.fn(), headings: vi.fn() }))
vi.mock('@/lib/markdown', () => ({ renderMarkdown: markdown.render, extractHeadings: markdown.headings }))
let display: typeof import('@/lib/article-display')
let frames: (() => void)[]

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback))
  markdown.render.mockReset().mockImplementation((content: string) => `<p>${content}</p>`)
  markdown.headings.mockReset().mockReturnValue([{ level: 2, id: 'heading', text: 'Heading' }, { level: 5, id: 'deep', text: 'Deep' }])
  display = await import('@/lib/article-display')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('asynchronous article display preparation', () => {
  it('allows a frame to paint before parsing and reuses a click/route request', async () => {
    const first = display.prepareArticleDisplay('Long body')
    expect(display.prepareArticleDisplay('Long body')).toBe(first)
    expect(display.peekArticleDisplay('Long body')).toBeNull()
    expect(markdown.render).not.toHaveBeenCalled()
    frames.shift()!()
    expect(markdown.render).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    await expect(first).resolves.toEqual({ html: '<p>Long body</p>', toc: [{ level: 2, id: 'heading', text: 'Heading' }] })
    expect(markdown.render).toHaveBeenCalledOnce()
    expect(display.peekArticleDisplay('Long body')?.html).toBe('<p>Long body</p>')
  })

  it('provides empty/protected bodies without scheduling Markdown work', async () => {
    await expect(display.prepareArticleDisplay('')).resolves.toEqual({ html: '', toc: [] })
    expect(frames).toHaveLength(0)
    expect(markdown.render).not.toHaveBeenCalled()
  })

  it('does not retain failed preparations and can retry', async () => {
    markdown.render.mockImplementationOnce(() => { throw new Error('Parse failed') })
    const first = display.prepareArticleDisplay('Body')
    const failure = expect(first).rejects.toThrow('Parse failed')
    frames.shift()!()
    await vi.runAllTimersAsync()
    await failure
    expect(display.peekArticleDisplay('Body')).toBeNull()
    const retry = display.prepareArticleDisplay('Body')
    frames.shift()!()
    await vi.runAllTimersAsync()
    await expect(retry).resolves.toMatchObject({ html: '<p>Body</p>' })
  })
})
