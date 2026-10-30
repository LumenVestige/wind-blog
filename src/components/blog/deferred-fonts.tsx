'use client'

import { useEffect } from 'react'

/** Load optional fonts after page resources finish and the main thread is idle. */
export function DeferredFonts({ href }: { href: string | null }) {
  useEffect(() => {
    if (!href) return
    let cancelled = false
    let idle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let link: HTMLLinkElement | undefined
    function load() {
      if (cancelled) return
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href!
      link.setAttribute('fetchpriority', 'low')
      document.head.appendChild(link)
    }
    function schedule() {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(load, { timeout: 3000 })
      } else {
        timer = setTimeout(load, 200)
      }
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (timer !== undefined) clearTimeout(timer)
      link?.remove()
    }
  }, [href])
  return null
}
