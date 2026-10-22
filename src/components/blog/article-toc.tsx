'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [pinned, setPinned] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const rootRef = useRef<HTMLElement>(null)

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

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => setPinned(root.getBoundingClientRect().top <= 88)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  const minLevel = Math.min(...toc.map((item) => item.level))
  function visible(index: number) {
    const item = toc[index]
    let parent: TocItem | undefined
    for (let i = index - 1; i >= 0; i -= 1) {
      if (toc[i].level < item.level) { parent = toc[i]; break }
    }
    return !parent || parent.level === minLevel || open[parent.id] !== false
  }
  function hasChildren(index: number) {
    return toc[index + 1]?.level > toc[index].level
  }

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
      <div ref={rootRef as React.RefObject<HTMLDivElement>} className={cn('mz-widget toc-card', pinned && 'is-pinned')} id="toc-wrapper" aria-label="目录">
        <h2 className="mz-widget-title">目录</h2>
        <ul className="mz-panel-list">
          {toc.map((item, index) => visible(index) && (
            <li key={item.id} className="toc-item" style={{ paddingLeft: `${Math.max(0, item.level - minLevel) * 0.75}rem` }}>
              {hasChildren(index) && <button type="button" className={cn('toc-toggle', open[item.id] === false && 'is-collapsed')} aria-label="展开目录" onClick={() => setOpen((old) => ({ ...old, [item.id]: old[item.id] === false }))}>▸</button>}
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
    <section ref={rootRef} className={cn('chirpy-toc toc-card mb-6', pinned && 'is-pinned')} id="toc-wrapper" aria-label="目录">
      <h2 className="chirpy-panel-heading">目录</h2>
      <nav className="mt-2">
        <ul className="chirpy-toc-list">
          {toc.map((item, index) => visible(index) && (
            <li
              key={item.id}
              className="chirpy-toc-item toc-item"
              data-level={item.level}
              style={{ paddingLeft: `${Math.max(0, item.level - minLevel) * 0.85}rem` }}
            >
              {hasChildren(index) && <button type="button" className={cn('toc-toggle', open[item.id] === false && 'is-collapsed')} aria-label="展开目录" onClick={() => setOpen((old) => ({ ...old, [item.id]: old[item.id] === false }))}>▸</button>}
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
