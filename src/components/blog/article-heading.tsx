'use client'

import { createContext, useContext, useLayoutEffect, useRef } from 'react'
import { BLOG_MOTION } from '@/lib/blog-motion-events'

export type ArticleHeadingEntrance = { pathname: string; startedAt: number; title?: string }
export const ArticleHeadingMotion = createContext<ArticleHeadingEntrance | null>(null)
const DURATION = BLOG_MOTION.titleEnter

/** Preview and real titles share a clock, so replacing the loading frame never
 * restarts a finished title or jumps an unfinished entrance to full opacity. */
export function ArticleHeading({ title, pathname }: { title: string; pathname: string }) {
  const entrance = useContext(ArticleHeadingMotion)
  const ref = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!entrance || entrance.pathname !== pathname || !ref.current || media.matches) return
    const elapsed = entrance.title === title ? Math.max(0, performance.now() - entrance.startedAt) : 0
    if (elapsed >= DURATION) return
    const motion = ref.current.animate(
      [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
      { duration: DURATION, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    )
    motion.currentTime = elapsed
    const reduce = () => { if (media.matches) motion.cancel() }
    media.addEventListener('change', reduce)
    return () => { motion.cancel(); media.removeEventListener('change', reduce) }
  }, [entrance, pathname, title])
  return <h1 ref={ref}>{title}</h1>
}
