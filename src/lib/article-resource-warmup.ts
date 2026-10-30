import { canPrefetchArticle } from '@/lib/article-prefetch'

let resources: Promise<unknown> | undefined

/** Load the reading UI without mounting it or requesting an article. */
export function warmArticleResources() {
  resources ??= import(/* webpackFetchPriority: "low" */ '@/components/blog/instant-article').catch((error) => {
    resources = undefined
    throw error
  })
  return resources
}

/** Speculation yields to initial loading, hidden pages and active interaction. */
export function scheduleArticleResourceWarmup(load: () => Promise<unknown>) {
  let stopped = false
  let loaded = document.readyState === 'complete'
  let timer: ReturnType<typeof setTimeout> | undefined
  let idle: number | undefined
  let quietUntil = 0

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    if (idle !== undefined) window.cancelIdleCallback(idle)
    timer = undefined
    idle = undefined
  }
  const allowed = () => loaded && document.visibilityState === 'visible' &&
    navigator.onLine !== false && canPrefetchArticle()
  const queue = () => {
    clear()
    if (stopped || !allowed()) return
    const quietFor = quietUntil - Date.now()
    if (quietFor > 0) {
      timer = setTimeout(queue, quietFor)
      return
    }
    if (typeof window.requestIdleCallback === 'function') {
      // No timeout: a busy browser must never be forced to run this work.
      idle = window.requestIdleCallback((deadline) => {
        idle = undefined
        const scheduling = (navigator as Navigator & { scheduling?: { isInputPending?: () => boolean } }).scheduling
        if (deadline.timeRemaining() < 12 || scheduling?.isInputPending?.()) {
          timer = setTimeout(queue, 250)
          return
        }
        run()
      })
    } else {
      // Safari fallback: leave a quiet interval after load or the last input.
      timer = setTimeout(run, 1500)
    }
  }
  const stop = () => {
    stopped = true
    clear()
    window.removeEventListener('load', onLoad)
    window.removeEventListener('online', queue)
    document.removeEventListener('visibilitychange', queue)
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.removeEventListener(event, onInput)
    }
  }
  const run = () => {
    if (stopped || !allowed()) return
    if (quietUntil > Date.now()) { queue(); return }
    stop()
    // Failed speculation stays invisible; a deliberate hover/click can retry.
    void load().catch(() => {})
  }
  const onLoad = () => { loaded = true; queue() }
  const onInput = () => { quietUntil = Date.now() + 1000; queue() }

  window.addEventListener('load', onLoad, { once: true })
  window.addEventListener('online', queue)
  document.addEventListener('visibilitychange', queue)
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    window.addEventListener(event, onInput, { passive: true })
  }
  queue()
  return stop
}
