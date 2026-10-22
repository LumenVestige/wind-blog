'use client'
import { useLayoutEffect, useRef } from 'react'

/** FLIP only the visual offset: layout and the real DOM order change immediately. */
export function useListMotion(order: string) {
  const ref = useRef<HTMLOListElement>(null)
  const previous = useRef(new Map<string, { top: number; left: number }>())
  useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    const bounds = list.getBoundingClientRect()
    const next = new Map<string, { top: number; left: number }>()
    const animations: Animation[] = []
    for (const item of list.querySelectorAll<HTMLElement>(
      '[data-motion-key]',
    )) {
      const key = item.dataset.motionKey!
      const rect = item.getBoundingClientRect()
      const position = {
        top: rect.top - bounds.top,
        left: rect.left - bounds.left,
      }
      const old = previous.current.get(key)
      next.set(key, position)
      if (
        old &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        animations.push(
          item.animate(
            [
              {
                translate: `${old.left - position.left}px ${old.top - position.top}px`,
              },
              { translate: '0 0' },
            ],
            { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          ),
        )
      }
    }
    previous.current = next
    return () => animations.forEach((animation) => animation.cancel())
  }, [order])
  return ref
}
