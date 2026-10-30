import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { bindArticleBlockMotion } from '@/lib/article-block-motion'
import { ARTICLE_ENTRANCE_EVENT } from '@/lib/blog-motion-events'

let root: HTMLElement
let animate: ReturnType<typeof vi.fn>
let measure: ReturnType<typeof vi.fn>
let cleanup: (() => void) | undefined
let reduced = false
let changeMotion: (() => void) | undefined
const original = '<p data-top="200">A paragraph with <a href="/target">a link</a>.</p><p data-top="260">Another paragraph.</p><img data-top="340" src="/image.png"><p data-top="1000">Offscreen text</p>'

beforeEach(() => {
  vi.useFakeTimers()
  const dom = parseHTML(`<html><body><div class="mz-shell"><div id="article-body"><div class="markdown-body">${original}</div></div></div></body></html>`)
  vi.stubGlobal('window', dom.window)
  vi.stubGlobal('document', dom.document)
  vi.stubGlobal('HTMLElement', dom.HTMLElement)
  vi.stubGlobal('Event', dom.window.Event)
  vi.stubGlobal('MutationObserver', dom.window.MutationObserver)
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 800 })
  reduced = false
  changeMotion = undefined
  Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: () => ({
    get matches() { return reduced },
    addEventListener(_event: string, callback: () => void) { changeMotion = callback },
    removeEventListener() { changeMotion = undefined },
  }) })
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16))
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id))
  animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }))
  measure = vi.fn(function (this: HTMLElement) {
    const top = Number(this.getAttribute('data-top') || 0)
    const height = Number(this.getAttribute('data-height') || 52)
    return { top, bottom: top + height, left: 0, right: 600, width: 600, height }
  })
  Object.defineProperty(dom.HTMLElement.prototype, 'animate', { configurable: true, value: animate })
  Object.defineProperty(dom.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: measure })
  root = dom.document.querySelector('.markdown-body') as HTMLElement
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.restoreAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function start() {
  root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
  cleanup = bindArticleBlockMotion(root)
  vi.advanceTimersByTime(16)
}

describe('article viewport block entrance', () => {
  it('keeps initial visits visible and only animates once after an in-site entrance', () => {
    cleanup = bindArticleBlockMotion(root)
    vi.advanceTimersByTime(1000)
    expect(measure).not.toHaveBeenCalled()
    expect(animate).not.toHaveBeenCalled()
    root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    expect(root.innerHTML).toBe(original)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
    vi.advanceTimersByTime(16)
    expect(animate).toHaveBeenCalledTimes(3)
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    vi.advanceTimersByTime(1000)
    expect(animate).toHaveBeenCalledTimes(3)
  })

  it('animates existing paragraphs without replacing links, text or other DOM', () => {
    const nodes = [...root.children]
    const link = root.querySelector('a')
    start()
    expect(root.innerHTML).toBe(original)
    expect([...root.children]).toEqual(nodes)
    expect(root.querySelector('a')).toBe(link)
    expect(animate.mock.instances).toEqual(nodes.slice(0, 3))
    expect(animate.mock.calls.map(([, options]) => options.delay)).toEqual([0, 45, 90])
    // Finish every geometry read before starting animations; no layout thrash.
    expect(Math.max(...measure.mock.invocationCallOrder)).toBeLessThan(Math.min(...animate.mock.invocationCallOrder))
    expect(root.lastElementChild?.getAttribute('style')).toBeNull()
  })

  it('does the same amount of measurement with 10 or 5000 offscreen paragraphs and lists', () => {
    const scan = vi.spyOn(root, 'querySelectorAll')
    const counts: number[] = []
    for (const count of [10, 5000]) {
      root.innerHTML = '<p data-top="200">Visible</p><section data-top="1000">' +
        '<p data-top="1100">Offscreen</p><ul><li data-top="1200">List item</li></ul>'.repeat(count) + '</section>'
      start()
      counts.push(measure.mock.calls.length)
      expect(animate).toHaveBeenCalledTimes(1)
      expect(measure.mock.instances).toEqual([root.firstElementChild, root.lastElementChild])
      cleanup!()
      measure.mockClear()
      animate.mockClear()
    }
    expect(counts).toEqual([2, 2])
    expect(scan).not.toHaveBeenCalled()
  })

  it('waits for exit and the skeleton surface to uncover the body before playing once', async () => {
    const shell = root.closest('.mz-shell')!
    const body = root.parentElement!
    const surface = document.createElement('div')
    surface.className = 'blog-page-transition'
    body.replaceWith(surface)
    surface.appendChild(body)
    surface.setAttribute('hidden', '')
    shell.setAttribute('data-blog-navigating', '')
    shell.setAttribute('data-blog-transitions', '')
    cleanup = bindArticleBlockMotion(root)
    vi.advanceTimersByTime(200)
    expect(measure).not.toHaveBeenCalled()
    shell.removeAttribute('data-blog-navigating')
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    vi.advanceTimersByTime(200)
    expect(animate).not.toHaveBeenCalled()
    surface.removeAttribute('hidden')
    await Promise.resolve()
    vi.advanceTimersByTime(16)
    expect(animate).toHaveBeenCalledTimes(3)
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    vi.advanceTimersByTime(1000)
    expect(animate).toHaveBeenCalledTimes(3)
  })

  it('stops at the viewport boundary inside nested containers', () => {
    root.innerHTML = '<section><blockquote><p data-top="200">Visible</p><p data-top="900">Below</p></blockquote><p data-top="1000">Later</p></section><p data-top="1200">Tail</p>'
    start()
    expect(animate.mock.instances).toEqual([root.querySelector('blockquote > p')])
    expect(measure.mock.instances).not.toContain(root.querySelector('section > p'))
    expect(measure.mock.instances).not.toContain(root.lastElementChild)
  })

  it('bounds target count and container measurements even with pathological markup', () => {
    root.innerHTML = '<p data-top="200">Same position</p>'.repeat(1000)
    start()
    expect(animate).toHaveBeenCalledTimes(24)
    expect(measure).toHaveBeenCalledTimes(24)
    cleanup!()
    measure.mockClear()
    animate.mockClear()
    root.innerHTML = '<div>'.repeat(150) + '<p>Deep text</p>' + '</div>'.repeat(150)
    start()
    expect(measure).toHaveBeenCalledTimes(96)
    expect(animate).not.toHaveBeenCalled()
  })

  it('moves native heading/list markers, dividers and code blocks with their original containers', () => {
    root.innerHTML = '<h2 data-top="100">Heading with a pseudo-element marker</h2><ol start="4"><li data-top="200" style="list-style-type:decimal">List item</li></ol><hr data-top="280"><div class="md-code-block" data-top="340" data-height="3000"><pre><span class="md-code-row">Code one</span><span class="md-code-row">Code two</span></pre></div>'
    const html = root.innerHTML
    const code = root.querySelector('.md-code-block')!
    const item = root.querySelector('li')!
    start()
    expect(animate.mock.instances).toEqual([root.querySelector('h2'), item, root.querySelector('hr'), code])
    expect(root.innerHTML).toBe(html)
    expect(item.getAttribute('style')).toBe('list-style-type:decimal')
    expect(measure.mock.instances).not.toContain(code.firstElementChild)
    expect(animate.mock.calls.at(-1)![0]).toEqual([{ opacity: 0, translate: '0 0' }, { opacity: 1, translate: '0 0' }])
  })

  it('uses one queue for article title, metadata and body without animating their ancestors twice', () => {
    const body = document.getElementById('article-body')!
    const article = document.createElement('article')
    article.className = 'mz-article'
    body.replaceWith(article)
    article.innerHTML = '<header><h1 data-top="80">Title</h1><div class="mz-article-info" data-top="160"><span class="mz-meta-item">Date</span></div></header>'
    article.appendChild(body)
    root = article
    start()
    expect(animate.mock.instances.slice(0, 3)).toEqual([root.querySelector('h1'), root.querySelector('.mz-article-info'), root.querySelector('#article-body p')])
    expect(measure.mock.instances).not.toContain(root.querySelector('.mz-meta-item'))
    expect(animate.mock.instances).not.toContain(root)
    expect(animate.mock.instances).not.toContain(body)
  })

  it('does not remeasure or restart on font completion or resize', () => {
    start()
    const measurements = measure.mock.calls.length
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new Event('loadingdone'))
    vi.advanceTimersByTime(1000)
    expect(measure).toHaveBeenCalledTimes(measurements)
    expect(animate).toHaveBeenCalledTimes(3)
  })

  it('measures the restored history viewport only after scroll restoration finishes', () => {
    const shell = root.closest('.mz-shell')!
    shell.setAttribute('data-blog-transitions', '')
    shell.setAttribute('data-blog-restoring', '')
    cleanup = bindArticleBlockMotion(root)
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    expect(measure).not.toHaveBeenCalled()
    shell.removeAttribute('data-blog-restoring')
    window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
    expect(animate).toHaveBeenCalledTimes(3)
  })

  it('cancels pending/active animations on unmount and when reduced motion is enabled', () => {
    root.closest('.mz-shell')!.setAttribute('data-blog-transitions', '')
    root.closest('.mz-shell')!.setAttribute('data-blog-navigating', '')
    cleanup = bindArticleBlockMotion(root)
    cleanup()
    vi.advanceTimersByTime(16)
    expect(animate).not.toHaveBeenCalled()
    root.closest('.mz-shell')!.removeAttribute('data-blog-navigating')
    start()
    reduced = true
    changeMotion!()
    expect(animate.mock.results.every(({ value }) => value.cancel.mock.calls.length === 1)).toBe(true)
    expect(root.innerHTML).toBe(original)
    animate.mockClear()
    start()
    expect(animate).not.toHaveBeenCalled()
  })

  it('leaves content readable and cancels started animations on failure', () => {
    animate.mockImplementationOnce(() => ({ cancel: vi.fn(), onfinish: null }))
      .mockImplementationOnce(() => { throw new Error('Animation unavailable') })
    start()
    expect(animate.mock.results[0].value.cancel).toHaveBeenCalledOnce()
    expect(root.innerHTML).toBe(original)
    expect(root.hasAttribute('data-line-motion')).toBe(false)
    expect(root.getAttribute('style')).toBeNull()
  })
})
