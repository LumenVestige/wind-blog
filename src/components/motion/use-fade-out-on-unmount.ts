'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

const FADE_OUT_MS = 220
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
      const shell = node.closest('.mz-shell')
      // A direct visit replaces delayed placeholders immediately, matching
      // the first page's no-entrance policy. Later navigation keeps its fade.
      if (shell && !shell.hasAttribute('data-blog-transitions')) return
      if (
        performance.now() - mountedAt.current < 240 ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        return
      const rect = node.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const styles = getComputedStyle(node)
      let opacity = 1
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
        opacity *= Number(getComputedStyle(parent).opacity)
      }
      // A deferred placeholder (or one leaving with its page) never flashes a ghost.
      if (opacity < 0.01) return
      // Keep the ghost inside the themed root so CSS variables still resolve.
      const host =
        node.closest<HTMLElement>('[data-blog-theme], [data-blog-admin]') ||
        document.body
      const ghost = node.cloneNode(true) as HTMLElement
      ghost.removeAttribute('id')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.setAttribute('data-fade-out-ghost', '')
      ghost.inert = true
      // Preserve each bar's current appearance instead of restarting its entrance.
      const bars = node.querySelectorAll<HTMLElement>('.mz-skeleton, [data-slot="skeleton"]')
      ghost.querySelectorAll<HTMLElement>('.mz-skeleton, [data-slot="skeleton"]').forEach((bar, index) => {
        const source = bars[index]
        if (!source) return
        const current = getComputedStyle(source)
        Object.assign(bar.style, { animation: 'none', opacity: current.opacity, backgroundPosition: current.backgroundPosition })
      })
      // Loading containers can own a delayed entrance too. Freeze that progress
      // instead of restarting their animation inside the fading copy.
      const regions = node.querySelectorAll<HTMLElement>('.mz-article-skeleton')
      ghost.querySelectorAll<HTMLElement>('.mz-article-skeleton').forEach((region, index) => {
        const source = regions[index]
        if (source) Object.assign(region.style, { animation: 'none', opacity: getComputedStyle(source).opacity })
      })
      Object.assign(ghost.style, {
        position: 'fixed',
        inset: 'auto',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: '9999',
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        borderRadius: styles.borderRadius,
        boxShadow: styles.boxShadow,
        animation: 'none',
        opacity: String(opacity),
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
