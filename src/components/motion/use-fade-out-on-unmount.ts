'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

const FADE_OUT_MS = 180
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Keeps a fading copy of the element on screen when React removes it, so
 * skeleton/loading placeholders leave smoothly instead of popping out.
 */
export function useFadeOutOnUnmount<T extends HTMLElement>(duration = FADE_OUT_MS) {
  const ref = useRef<T>(null)
  const mountedAt = useRef(0)

  useIsomorphicLayoutEffect(() => {
    mountedAt.current = performance.now()
    return () => {
      const node = ref.current
      if (!node || typeof document === 'undefined') return
      if (
        performance.now() - mountedAt.current < 240 ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        return
      const rect = node.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const styles = getComputedStyle(node)
      // Keep the ghost inside the themed root so CSS variables still resolve.
      const host =
        node.closest<HTMLElement>('[data-blog-theme], [data-blog-admin]') ||
        document.body
      const ghost = node.cloneNode(true) as HTMLElement
      ghost.removeAttribute('id')
      ghost.setAttribute('aria-hidden', 'true')
      Object.assign(ghost.style, {
        position: 'fixed',
        inset: 'auto',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        pointerEvents: 'none',
        zIndex: '9999',
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
        animation: 'none',
        opacity: '1',
        transition: `opacity ${duration}ms ease`,
      })
      host.appendChild(ghost)
      void ghost.offsetHeight
      ghost.style.opacity = '0'
      window.setTimeout(() => ghost.remove(), duration + 40)
    }
  }, [duration])

  return ref
}
