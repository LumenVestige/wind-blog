'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/** Fresh pages start at the top; history and chapter links keep native scrolling. */
export function useBlogRouteScroll() {
  const pathname = usePathname()
  const previous = useRef(pathname)
  const historyPath = useRef<string | null>(null)
  const positions = useRef(new Map<string, { x: number; y: number }>())

  useEffect(() => {
    const restore = () => {
      historyPath.current = window.location.pathname === previous.current
        ? null
        : window.location.pathname
    }
    const save = () => {
      if (historyPath.current !== null) return
      positions.current.set(window.location.pathname + window.location.search, {
        x: window.scrollX,
        y: window.scrollY,
      })
    }
    save()
    window.addEventListener('scroll', save, { passive: true })
    // Observe traversal before the router's bubbling listener can commit it.
    window.addEventListener('popstate', restore, true)
    return () => {
      window.removeEventListener('popstate', restore, true)
      window.removeEventListener('scroll', save)
    }
  }, [])

  useLayoutEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    const restoring = historyPath.current === pathname
    if (restoring) {
      const position = positions.current.get(pathname + window.location.search)
      // The outgoing page can temporarily clamp the browser's restored offset.
      // Restore once the destination's content has committed and laid out.
      const frame = requestAnimationFrame(() => {
        if (position && !window.location.hash) {
          window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' })
        }
        historyPath.current = null
      })
      return () => cancelAnimationFrame(frame)
    }
    historyPath.current = null
    if (window.location.hash) return

    // Next may preserve a visible page's offset. Reset only after the new route
    // commits, so the outgoing page's history position remains intact.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
}
