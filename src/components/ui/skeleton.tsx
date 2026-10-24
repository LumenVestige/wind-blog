'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const FADE_OUT_MS = 180
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null)
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
      const ghost = node.cloneNode(true) as HTMLElement
      ghost.removeAttribute('data-slot')
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
        borderRadius: styles.borderRadius,
        animation: 'none',
        opacity: '1',
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      })
      document.body.appendChild(ghost)
      void ghost.offsetHeight
      ghost.style.opacity = '0'
      window.setTimeout(() => ghost.remove(), FADE_OUT_MS + 40)
    }
  }, [])

  return (
    <div
      ref={ref}
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  )
}

export { Skeleton }
