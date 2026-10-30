'use client'

import { useContext, useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { ArticleHeadingMotion } from './article-heading'
import { BLOG_MOTION } from '@/lib/blog-motion-events'

/** Only the empty backdrop fades. Text owns its own entrance, so no ancestor
 * opacity multiplies the paragraph, title or metadata animations. */
export function MizukiArticleCard({ pathname, loading = false, className, children, ...props }: ComponentPropsWithoutRef<'article'> & {
  pathname: string
  loading?: boolean
}) {
  const entrance = useContext(ArticleHeadingMotion)
  const backdrop = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!entrance || entrance.pathname !== pathname || !backdrop.current || media.matches) return
    const elapsed = Math.max(0, performance.now() - entrance.startedAt)
    if (elapsed >= BLOG_MOTION.pageEnter) return
    const animation = backdrop.current.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: BLOG_MOTION.pageEnter, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards',
    })
    animation.currentTime = elapsed
    const reduce = () => { if (media.matches) animation.cancel() }
    media.addEventListener('change', reduce)
    return () => { animation.cancel(); media.removeEventListener('change', reduce) }
  }, [entrance, pathname])
  return <article {...props} className={`mz-article${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`} data-article-card>
    <div ref={backdrop} className="mz-article-backdrop" aria-hidden="true" />
    {children}
  </article>
}
