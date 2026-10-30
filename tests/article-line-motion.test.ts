import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'

const plugin = vi.hoisted(() => ({ create: vi.fn(), register: vi.fn() }))
vi.mock('gsap', () => ({ default: { registerPlugin: plugin.register } }))
vi.mock('gsap/SplitText', () => ({ SplitText: { create: plugin.create } }))

import { bindArticleLineMotion } from '@/lib/article-line-motion'
import { ARTICLE_ENTRANCE_EVENT } from '@/lib/blog-motion-events'

let root: HTMLElement
let animate: ReturnType<typeof vi.fn>
let cleanup: (() => void) | undefined
let reduced = false
let width = 600
let fonts: HTMLElement
const original = '<p data-top="200">A paragraph with <a href="/target">a link</a> and enough text for two lines.</p><p data-top="260">Another paragraph.</p><img data-top="340" src="/image.png"><p data-top="1000">Offscreen text</p>'

beforeEach(() => {
  vi.useFakeTimers()
  const dom = parseHTML(`<html><body><div class="mz-shell"><div id="article-body"><div class="markdown-body">${original}</div></div></div></body></html>`)
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('Event', dom.window.Event)
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 800 })
  reduced = false
  width = 600
  fonts = dom.document.createElement('span')
  Object.defineProperty(dom.document, 'fonts', { configurable: true, value: fonts })
  Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: () => ({
    get matches() { return reduced }, addEventListener() {}, removeEventListener() {},
  }) })
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16))
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id))
  animate = vi.fn(() => ({ cancel: vi.fn(), currentTime: 0 }))
  Object.defineProperty(dom.HTMLElement.prototype, 'animate', { configurable: true, value: animate })
  Object.defineProperty(dom.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value() {
    const top = Number(this.getAttribute('data-top') || 0)
    const height = this.classList.contains('mz-reading-line') ? 26 : 52
    return { top, bottom: top + height, left: 0, right: width, width, height }
  } })
  root = dom.document.querySelector('.markdown-body') as HTMLElement
  plugin.create.mockReset().mockImplementation((element: HTMLElement) => {
    const html = element.innerHTML
    const top = Number(element.getAttribute('data-top'))
    element.innerHTML = `<span class="mz-reading-line" data-top="${top}">Visual line one</span><span class="mz-reading-line" data-top="${top + 26}">Visual line two</span>`
    return { lines: [...element.children], revert: () => { element.innerHTML = html } }
  })
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function start() {
  root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
  cleanup = bindArticleLineMotion(root)
  vi.advanceTimersByTime(16)
}

describe('article visual line entrance', () => {
  it('keeps the initial visit unchanged and waits for an in-site entrance', () => {
    cleanup = bindArticleLineMotion(root)
    vi.advanceTimersByTime(1000)
    expect(plugin.create).not.toHaveBeenCalled()
    expect(root.innerHTML).toBe(original)
    root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    vi.advanceTimersByTime(16)
    expect(plugin.create).toHaveBeenCalledTimes(2)
  })

  it('animates separate visual lines in the same paragraph with distinct, bounded delays', () => {
    start()
    expect(animate).toHaveBeenCalledTimes(5) // Four text lines plus the image.
    expect(animate.mock.instances[0]).toBe(root.querySelector('p > span:first-child'))
    expect(animate.mock.instances[1]).toBe(root.querySelector('p > span:nth-child(2)'))
    const delays = animate.mock.calls.map(([, options]) => options.delay)
    expect(delays).toEqual([0, 24, 48, 72, 96])
    expect(plugin.create.mock.calls.every(([, options]) => options.type === 'lines' && options.aria === 'none')).toBe(true)
    expect(root.lastElementChild?.textContent).toBe('Offscreen text')
  })

  it('restores the original text, links and image markup after the entrance', () => {
    start()
    vi.advanceTimersByTime(1000)
    expect(root.innerHTML).toBe(original)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/target')
  })

  it('remeasures a width change and continues from the same animation time', () => {
    start()
    vi.advanceTimersByTime(100)
    width = 400
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(16)
    expect(root.getAttribute('data-line-motion')).toBe('running')
    expect(plugin.create).toHaveBeenCalledTimes(4)
    expect(animate.mock.results.at(-1)!.value.currentTime).toBe(116)
    vi.advanceTimersByTime(1000)
    expect(root.innerHTML).toBe(original)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
  })

  it('ignores height-only resize events rather than cancelling the entrance', () => {
    start()
    vi.advanceTimersByTime(60)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(16)
    expect(root.getAttribute('data-line-motion')).toBe('running')
    expect(plugin.create).toHaveBeenCalledTimes(2)
    expect(animate.mock.results.every((result) => result.value.cancel.mock.calls.length === 0)).toBe(true)
  })

  it('does not swallow a pending entrance when fonts finish before its first frame', () => {
    root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
    cleanup = bindArticleLineMotion(root)
    fonts.dispatchEvent(new Event('loadingdone'))
    vi.advanceTimersByTime(16)
    expect(root.getAttribute('data-line-motion')).toBe('running')
    expect(animate).toHaveBeenCalledTimes(5)
  })

  it('resplits new fonts on the common clock without restarting or skipping the animation', () => {
    start()
    vi.advanceTimersByTime(100)
    fonts.dispatchEvent(new Event('loadingdone'))
    fonts.dispatchEvent(new Event('loadingdone'))
    vi.advanceTimersByTime(16)
    expect(plugin.create).toHaveBeenCalledTimes(4)
    expect(root.getAttribute('data-line-motion')).toBe('running')
    expect(animate.mock.results.at(-1)!.value.currentTime).toBe(116)
    expect(plugin.create.mock.calls.every(([, options]) => options.autoSplit === false)).toBe(true)
    // Font completion cannot extend the original 456ms entrance window.
    vi.advanceTimersByTime(341)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
    expect(root.innerHTML).toBe(original)
    fonts.dispatchEvent(new Event('loadingdone'))
    vi.advanceTimersByTime(16)
    expect(plugin.create).toHaveBeenCalledTimes(4)
  })

  it('never splits or hides content with reduced motion enabled', () => {
    reduced = true
    start()
    expect(plugin.create).not.toHaveBeenCalled()
    expect(animate).not.toHaveBeenCalled()
    expect(root.innerHTML).toBe(original)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
  })

  it('cancels a pending entrance on unmount without stranding hidden text', () => {
    root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
    cleanup = bindArticleLineMotion(root)
    expect(root.getAttribute('data-line-motion')).toBe('pending')
    cleanup()
    vi.advanceTimersByTime(1000)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
    expect(plugin.create).not.toHaveBeenCalled()
  })

  it('uses one line queue for the title, information rows and body, and keeps code atomic', () => {
    const body = document.getElementById('article-body')!
    const article = document.createElement('article')
    article.className = 'mz-article'
    body.replaceWith(article)
    article.innerHTML = '<header class="mz-article-header"><h1 data-top="80">Title</h1><div class="mz-article-info"><div class="mz-article-meta"><span class="mz-meta-item" data-top="160">Date</span><span class="mz-meta-item" data-top="160">Category</span></div><div class="mz-article-details"><span data-top="190">Views</span></div></div></header>'
    article.appendChild(body)
    root.innerHTML += '<div class="md-code-block" data-top="450"><pre><span class="md-code-row">Code line one</span><span class="md-code-row">Code line two</span></pre></div>'
    root = article
    vi.stubGlobal('getComputedStyle', () => ({
      backgroundColor: 'transparent', backgroundImage: 'none', boxShadow: 'none', position: 'relative',
      width: '4px', height: '16px', left: '-16px', top: '3px', borderRadius: '2px',
      getPropertyValue: (property: string) => property.endsWith('width') ? '0px' : property.endsWith('style') ? 'none' : 'transparent',
    }))
    start()
    const delayOf = (element: Element | null) => animate.mock.calls[animate.mock.instances.indexOf(element)][1].delay
    const titleLines = root.querySelectorAll('h1 > .mz-reading-line')
    const metadata = root.querySelectorAll('.mz-meta-item')
    const bodyLine = root.querySelector('#article-body .mz-reading-line')
    const title = root.querySelector('h1')!
    const info = root.querySelector('.mz-article-info')!
    expect(delayOf(titleLines[1])).toBeGreaterThan(delayOf(title))
    expect(delayOf(info)).toBeGreaterThan(delayOf(titleLines[1]))
    expect(animate.mock.instances).not.toContain(metadata[0])
    expect(animate.mock.instances).not.toContain(metadata[1])
    expect(delayOf(bodyLine)).toBeGreaterThan(delayOf(root.querySelector('.mz-article-details > span')))
    expect(animate.mock.instances).toContain(title)
    expect(root.querySelector('[data-line-decoration]')).toBeNull()
    expect(animate.mock.instances).toContain(root.querySelector('.md-code-block'))
    expect(animate.mock.instances).not.toContain(root.querySelector('.md-code-row'))
  })

  it('moves the native list item with its first line without replacing its marker', () => {
    root.innerHTML = '<ol start="4"><li data-top="200" style="list-style-type:decimal">Two visual lines</li></ol>'
    const item = root.querySelector('li')!
    const originalStyle = item.getAttribute('style')
    start()
    expect(animate.mock.instances[0]).toBe(item)
    expect(animate.mock.instances[1]).toBe(item.querySelector('.mz-reading-line:nth-child(2)'))
    expect(item.getAttribute('style')).toBe(originalStyle)
    expect(root.querySelector('[data-line-marker]')).toBeNull()
    vi.advanceTimersByTime(1000)
    expect(item.getAttribute('style')).toBe(originalStyle)
    expect(item.textContent).toBe('Two visual lines')
  })
})
