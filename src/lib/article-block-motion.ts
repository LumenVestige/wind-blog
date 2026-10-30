import { ARTICLE_ENTRANCE_EVENT } from '@/lib/blog-motion-events'

const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,pre,table,img,video,hr,.katex-display,.obsidian-mermaid,.md-code-block,.obsidian-callout,.obsidian-embed,.obsidian-callout-title,.mz-article-info,summary'
const IGNORE = 'svg,button,input,.katex,.math-fallback,.obsidian-footnotes,[hidden]'
const MAX_MEASUREMENTS = 96
const MAX_TARGETS = 24
const noop = () => {}

/** Animate original blocks in the opening viewport without splitting text or
 * changing the DOM. All geometry reads finish before any animations are created.
 */
export function bindArticleBlockMotion(root: HTMLElement): () => void {
  const shell = root.closest<HTMLElement>('.mz-shell')
  if (!shell || (!root.matches('.mz-article') && !root.closest('#article-body'))) return noop
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const animations = new Set<Animation>()
  // The route can mount while navigation still covers/hides its surface. Watch
  // only that surface's visibility, never the article's descendants.
  const surface = root.closest<HTMLElement>('.blog-page-transition')
  let visibility: MutationObserver | undefined
  let played = false
  let stopped = false
  let frame = 0

  const cancel = () => {
    cancelAnimationFrame(frame)
    frame = 0
    animations.forEach((animation) => animation.cancel())
    animations.clear()
  }
  const run = () => {
    frame = 0
    if (stopped || played || !root.isConnected || media.matches ||
      shell.hasAttribute('data-blog-navigating') || root.closest('[hidden]')) return
    played = true
    visibility?.disconnect()
    const viewportHeight = window.innerHeight
    const targets: { element: HTMLElement; rect: DOMRect }[] = []
    let measurements = 0
    // Markdown uses normal document flow. The first block below the viewport
    // ends the walk, including within nested containers. Never enumerate a full
    // article or enter an atomic block's code tokens, table cells or list items.
    const collect = (parent: Element): boolean => {
      for (let child = parent.firstElementChild; child; child = child.nextElementSibling) {
        if (measurements >= MAX_MEASUREMENTS || targets.length >= MAX_TARGETS) return false
        if (!(child instanceof HTMLElement) || child.matches(IGNORE)) continue
        measurements++
        const rect = child.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0) continue
        if (rect.top >= viewportHeight) return false
        if (child.matches(BLOCK)) targets.push({ element: child, rect })
        else if (!collect(child)) return false
      }
      return true
    }
    try {
      collect(root)
      targets.sort((a, b) => a.rect.top - b.rect.top)
      let top = -Infinity
      let rank = -1
      for (const { element, rect } of targets) {
        if (rect.top - top > 5) { rank++; top = rect.top }
        // Tall code/list blocks still fade in, without translating a large
        // surface or inspecting any of their offscreen descendants.
        const translate = rect.height > viewportHeight ? '0 0' : '0 10px'
        const animation = element.animate(
          [{ opacity: 0, translate }, { opacity: 1, translate: '0 0' }],
          { duration: 300, delay: Math.min(rank * 35, 140), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
        )
        animations.add(animation)
        animation.onfinish = () => { animations.delete(animation); animation.cancel() }
      }
    } catch {
      // Animation support/measurement failures must leave the article readable.
      cancel()
    }
  }
  const start = () => {
    if (played || stopped || frame || media.matches || root.closest('[hidden]') || shell.hasAttribute('data-blog-navigating') || !shell.hasAttribute('data-blog-transitions')) return
    // Keep content visible while awaiting this frame. There is no hidden
    // preparation phase, font wait or re-splitting on resize.
    frame = requestAnimationFrame(run)
  }
  const reduce = () => { if (media.matches) cancel() }
  if (surface) {
    visibility = new MutationObserver(start)
    visibility.observe(surface, { attributes: true, attributeFilter: ['hidden'] })
  }
  window.addEventListener(ARTICLE_ENTRANCE_EVENT, start)
  media.addEventListener('change', reduce)
  start()
  return () => {
    stopped = true
    cancel()
    visibility?.disconnect()
    window.removeEventListener(ARTICLE_ENTRANCE_EVENT, start)
    media.removeEventListener('change', reduce)
  }
}
