import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ARTICLE_ENTRANCE_EVENT } from '@/lib/blog-motion-events'

const TEXT = 'p,h1,h2,h3,h4,h5,h6,li,.mz-line-source'
const ATOMIC = 'img,video,hr,table,.katex-display,.obsidian-mermaid,.md-code-block,.obsidian-callout-title,summary,.mz-meta-item,.mz-article-details > span,.mz-article-details > a'
const IGNORE = '.katex,.math-fallback,svg,img,video,button,input'
const noop = () => {}

/** Split only the opening viewport into actual rendered lines, then restore it.
 * Offscreen content stays readable and never waits for scrolling to reveal it.
 */
export function bindArticleLineMotion(root: HTMLElement): () => void {
  const shell = root.closest<HTMLElement>('.mz-shell')
  if (!shell || (!root.matches('.mz-article') && !root.closest('#article-body'))) return noop
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let played = false
  let ended = false
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let startedAt: number | null = null
  let staggerWindow: number | null = null
  let width = root.getBoundingClientRect().width
  const splits: SplitText[] = []
  const animations: Animation[] = []
  const inlineGroups: HTMLElement[] = []

  const restore = () => {
    animations.splice(0).forEach((animation) => animation.cancel())
    splits.splice(0).reverse().forEach((split) => split.revert())
    inlineGroups.splice(0).reverse().forEach((group) => group.replaceWith(...group.childNodes))
  }
  const finish = () => {
    ended = true
    cancelAnimationFrame(frame)
    frame = 0
    clearTimeout(timer)
    restore()
    root.removeAttribute('data-line-motion')
  }
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
  }
  const run = () => {
    frame = 0
    if (ended || !root.isConnected || media.matches) { finish(); return }
    try {
      gsap.registerPlugin(SplitText)
      // A nested list's leading text is an anonymous line box. Give just that
      // inline run a temporary source so its marker can travel with the text.
      for (const item of root.querySelectorAll<HTMLElement>('li')) {
        if (!visible(item) || !item.querySelector('ul,ol,p,pre,table')) continue
        let inline: ChildNode[] = []
        const flush = () => {
          if (inline.some((node) => /\S/.test(node.textContent || ''))) {
            const group = document.createElement('span')
            group.className = 'mz-line-source'
            item.insertBefore(group, inline[0])
            group.append(...inline)
            inlineGroups.push(group)
          }
          inline = []
        }
        for (const node of [...item.childNodes]) {
          if (node.nodeType === 1 && (node as Element).matches('p,ul,ol,pre,table,blockquote,div')) flush()
          else inline.push(node)
        }
        flush()
      }
      const rows: HTMLElement[] = []
      const selected = new Set<Element>()
      let characters = 0
      const candidates = [...root.querySelectorAll<HTMLElement>(`${TEXT},${ATOMIC},pre`)]
      for (const element of candidates) {
        if (!visible(element) || element.closest('.obsidian-footnotes')) continue
        if ([...selected].some((parent) => parent.contains(element))) continue
        if (element.matches(TEXT) && element.querySelector(`${TEXT},ul,ol,pre,table`)) continue
        selected.add(element)
        const length = element.textContent?.length || 0
        const splitText = element.matches(TEXT) && length > 0 && characters + length <= 6000 &&
          !element.querySelector('img,video,.katex-display,.obsidian-mermaid')
        if (!splitText) { rows.push(element); continue }
        characters += length
        const height = element.getBoundingClientRect().height
        const split = SplitText.create(element, {
          type: 'lines',
          tag: 'span',
          // Inline character probes retain native CJK/Latin word wrapping.
          // Only the resulting line wrappers remain after measurement.
          wordDelimiter: '',
          linesClass: 'mz-reading-line',
          aria: 'none',
          deepSlice: true,
          ignore: IGNORE,
          // This controller owns font/width changes and the common clock.
          // Independent re-splitting would detach the animated line elements.
          autoSplit: false,
        })
        // Complex inline layouts keep their original geometry and enter intact.
        if (Math.abs(element.getBoundingClientRect().height - height) > 2) {
          split.revert()
          rows.push(element)
        } else {
          splits.push(split)
          rows.push(...split.lines.filter(visible) as HTMLElement[])
        }
      }
      const ordered = rows.filter(visible).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      const ranks = new Map<HTMLElement, number>()
      let rowTop = -Infinity
      let rank = -1
      for (const row of ordered) {
        const top = row.getBoundingClientRect().top
        if (top - rowTop > 5) { rank++; rowTop = top }
        ranks.set(row, rank)
      }
      staggerWindow ??= Math.min(280, Math.max(0, rank) * 24)
      const step = staggerWindow / Math.max(1, rank)
      const units = new Map<HTMLElement, number>()
      ordered.forEach((row) => {
        let unit = row
        // Keep native markers, pseudo-elements, borders and backgrounds. The
        // first line moves its original decorated container; later lines still
        // have individual offsets on the same timeline. No stand-in glyphs.
        for (let parent = row.parentElement; parent && parent !== root; parent = parent.parentElement) {
          if (parent.matches('li,h1,h2,h3,h4,h5,h6,blockquote,.mz-article-info,.obsidian-callout,.obsidian-embed') &&
              ordered.find((candidate) => parent.contains(candidate)) === row) unit = parent
        }
        const rowRank = ranks.get(row)!
        if (!units.has(unit)) units.set(unit, rowRank)
      })
      // All capsules on a metadata row inherit their shared container's move.
      // Do not multiply opacity/translation for siblings on that same row.
      for (const [unit, rowRank] of units) {
        for (let parent = unit.parentElement; parent && parent !== root; parent = parent.parentElement) {
          if (units.get(parent) === rowRank) { units.delete(unit); break }
        }
      }
      startedAt ??= Date.now()
      const elapsed = Date.now() - startedAt
      if (elapsed >= 320 + staggerWindow) { finish(); return }
      units.forEach((rowRank, unit) => {
        const animation = unit.animate(
          [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }],
          { duration: 320, delay: rowRank * step, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
        )
        // Reflow continues from the original navigation's time, never zero.
        if (elapsed) animation.currentTime = elapsed
        animations.push(animation)
      })
      root.setAttribute('data-line-motion', 'running')
      clearTimeout(timer)
      timer = setTimeout(finish, 360 + staggerWindow - elapsed)
    } catch {
      // A measurement failure must never leave the actual article hidden.
      finish()
    }
  }
  const start = () => {
    if (played || media.matches || !shell.hasAttribute('data-blog-transitions')) return
    played = true
    root.setAttribute('data-line-motion', 'pending')
    // Layout effects finish restoring the route's scroll position before this frame.
    frame = requestAnimationFrame(run)
  }
  const reflow = () => {
    if (!played || ended || frame || !root.isConnected) return
    frame = requestAnimationFrame(() => {
      frame = 0
      restore()
      run()
    })
  }
  const resize = () => {
    const nextWidth = root.getBoundingClientRect().width
    // Browser chrome and mobile address bars also emit height-only resizes.
    if (Math.abs(nextWidth - width) <= 0.5) return
    width = nextWidth
    reflow()
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  observer?.observe(root)
  const reduce = () => { if (media.matches) finish() }
  window.addEventListener(ARTICLE_ENTRANCE_EVENT, start)
  window.addEventListener('resize', resize)
  document.fonts?.addEventListener('loadingdone', reflow)
  media.addEventListener('change', reduce)
  start()
  return () => {
    finish()
    observer?.disconnect()
    window.removeEventListener(ARTICLE_ENTRANCE_EVENT, start)
    window.removeEventListener('resize', resize)
    document.fonts?.removeEventListener('loadingdone', reflow)
    media.removeEventListener('change', reduce)
  }
}
