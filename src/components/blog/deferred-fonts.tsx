'use client'

import { useEffect } from 'react'

/** Load optional fonts after page resources finish and the main thread is idle. */
export function DeferredFonts({ href, selector }: { href: string | null; selector?: string }) {
  useEffect(() => {
    if (!href) return
    let cancelled = false
    let idle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let link: HTMLLinkElement | undefined
    let intersection: IntersectionObserver | undefined
    let mutations: MutationObserver | undefined
    let started = false
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
    function start() {
      if (started || cancelled) return
      started = true
      intersection?.disconnect()
      mutations?.disconnect()
      if (document.readyState === 'complete') schedule()
      else window.addEventListener('load', schedule, { once: true })
    }
    if (selector) {
      if (typeof IntersectionObserver === 'function') {
        intersection = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) start()
        }, { rootMargin: '200px' })
      }
      const observed = new WeakSet<Element>()
      function watch() {
        if (started || cancelled) return
        for (const node of document.querySelectorAll(selector!)) {
          if (!intersection) { start(); return }
          if (!observed.has(node)) {
            observed.add(node)
            intersection.observe(node)
          }
        }
      }
      // Blog navigation can insert code blocks without remounting the root layout.
      mutations = new MutationObserver(watch)
      mutations.observe(document.body, { childList: true, subtree: true })
      watch()
    } else start()
    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (timer !== undefined) clearTimeout(timer)
      intersection?.disconnect()
      mutations?.disconnect()
      link?.remove()
    }
  }, [href, selector])
  return null
}
