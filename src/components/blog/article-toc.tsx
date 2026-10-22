'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TocItem {
  id: string
  text: string
  level: number
}

const SCROLL_OFFSET_PX = 3 * 16 + 12 + 8

export function ArticleToc({
  toc,
  variant = 'chirpy',
}: {
  toc: TocItem[]
  variant?: 'chirpy' | 'mizuki'
}) {
  const [activeId, setActiveId] = useState(toc[0]?.id || 'article-top')

  useEffect(() => {
    if (toc.length === 0) return
    const resolveActive = () => {
      let current = toc[0]?.id || 'article-top'
      for (const item of toc) {
        if (item.id === 'article-top') continue
        const el = document.getElementById(item.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= SCROLL_OFFSET_PX) current = item.id
      }
      const doc = document.documentElement
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 48) {
        const last = [...toc].reverse().find((t) => t.id !== 'article-top')
        if (last) current = last.id
      }
      setActiveId((prev) => (prev === current ? prev : current))
    }
    resolveActive()
    window.addEventListener('scroll', resolveActive, { passive: true })
    window.addEventListener('resize', resolveActive)
    return () => {
      window.removeEventListener('scroll', resolveActive)
      window.removeEventListener('resize', resolveActive)
    }
  }, [toc])

  function scrollTo(item: TocItem) {
    if (item.id === 'article-top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      history.replaceState(null, '', location.pathname)
      setActiveId('article-top')
      return
    }
    const el = document.getElementById(item.id)
    if (!el) return
    const y = window.scrollY + el.getBoundingClientRect().top - SCROLL_OFFSET_PX + 4
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    history.replaceState(null, '', `#${item.id}`)
    setActiveId(item.id)
  }

  if (variant === 'mizuki') {
    return (
      <div className="mz-widget" id="toc-wrapper" aria-label="文章内容">
        <h2 className="mz-widget-title">文章内容</h2>
        <ul className="mz-panel-list">
          {toc.map((item) => (
            <li key={item.id} style={{ paddingLeft: `${Math.max(0, item.level - 1) * 0.55}rem` }}>
              <a
                href={item.id === 'article-top' ? '#' : `#${item.id}`}
                data-toc-id={item.id}
                className={cn(activeId === item.id && 'is-active')}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(item)
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section className="chirpy-toc mb-6" id="toc-wrapper" aria-label="文章内容">
      <h2 className="chirpy-panel-heading">文章内容</h2>
      <nav className="mt-2">
        <ul className="chirpy-toc-list">
          {toc.map((item) => (
            <li
              key={item.id}
              className="chirpy-toc-item"
              data-level={item.level}
              style={{ paddingLeft: `${Math.max(0, item.level - 1) * 0.7}rem` }}
            >
              <a
                href={item.id === 'article-top' ? '#' : `#${item.id}`}
                data-toc-id={item.id}
                className={cn('chirpy-toc-link', activeId === item.id && 'is-active')}
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(item)
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
