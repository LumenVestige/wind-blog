'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { cn } from '@/lib/utils'
import { readingHeadingIds, scrollTocItemIntoView } from '@/lib/toc-scroll'

export interface TocItem {
  id: string
  text: string
  level: number
}

export function ArticleToc({
  toc,
  variant = 'chirpy',
}: {
  toc: TocItem[]
  variant?: 'chirpy' | 'mizuki'
}) {
  const [reading, setReading] = useState({
    activeId: toc[0]?.id || 'article-top',
    ids: [toc[0]?.id || 'article-top'],
  })
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const cardRef = useRef<HTMLElement>(null)
  const outlineRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const minLevel = Math.min(...toc.map((item) => item.level))
  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const scrollOffset = () =>
    cardRef.current
      ? parseFloat(getComputedStyle(cardRef.current).top) || 68
      : 68

  function visible(index: number) {
    const level = toc[index].level
    let parentLevel = level
    for (let i = index - 1; i >= 0; i -= 1) {
      if (toc[i].level < parentLevel) {
        if (open[toc[i].id] === false) return false
        parentLevel = toc[i].level
      }
    }
    return true
  }

  useEffect(() => {
    const card = cardRef.current
    let link = card?.querySelector<HTMLElement>(
      `[data-toc-id="${CSS.escape(reading.activeId)}"]`,
    )
    if (link?.closest('[data-collapsed="true"]')) {
      const index = toc.findIndex((item) => item.id === reading.activeId)
      for (let i = index - 1; i >= 0; i--) {
        const candidate = card?.querySelector<HTMLElement>(
          `[data-toc-id="${CSS.escape(toc[i].id)}"]`,
        )
        if (candidate && !candidate.closest('[data-collapsed="true"]')) {
          link = candidate
          break
        }
      }
    }
    if (!card || !link || link.closest('[data-collapsed="true"]')) return
    const stop = () => gsap.killTweensOf(card, 'scrollTop')
    scrollTocItemIntoView(card, link, (top) => {
      stop()
      if (reducedMotion()) card.scrollTop = top
      else
        gsap.to(card, {
          scrollTop: top,
          duration: 0.4,
          ease: 'power3.out',
          overwrite: 'auto',
        })
    })
    card.addEventListener('wheel', stop, { passive: true })
    card.addEventListener('touchstart', stop, { passive: true })
    card.addEventListener('pointerdown', stop, { passive: true })
    return () => {
      stop()
      card.removeEventListener('wheel', stop)
      card.removeEventListener('touchstart', stop)
      card.removeEventListener('pointerdown', stop)
    }
  }, [reading.activeId, open])

  useLayoutEffect(() => {
    const outline = outlineRef.current
    const highlight = highlightRef.current
    if (!outline || !highlight) return
    const measure = () => {
      const rows = [
        ...outline.querySelectorAll<HTMLElement>('[data-toc-row]'),
      ].filter((row) => row.dataset.collapsed !== 'true')
      let selected = rows.filter((row) =>
        reading.ids.includes(row.dataset.tocRow || ''),
      )
      // A collapsed branch keeps its visible parent highlighted.
      if (selected.length === 0) {
        const activeIndex = toc.findIndex(
          (item) => item.id === reading.activeId,
        )
        for (let i = activeIndex; i >= 0; i -= 1) {
          const parent = rows.find((row) => row.dataset.tocRow === toc[i].id)
          if (parent) {
            selected = [parent]
            break
          }
        }
      }
      const first = selected[0]?.getBoundingClientRect()
      const last = selected.at(-1)?.getBoundingClientRect()
      if (!first || !last || outline.clientHeight === 0) {
        highlight.style.opacity = '0'
        return
      }
      highlight.style.transform = `translateY(${first.top - outline.getBoundingClientRect().top}px)`
      highlight.style.height = `${last.bottom - first.top}px`
      highlight.style.opacity = '1'
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outline)
    return () => observer.disconnect()
  }, [reading, open, toc])

  useEffect(() => {
    if (toc.length === 0) return
    let frame = 0
    const resolve = () => {
      frame = 0
      const headings = toc.flatMap((item) => {
        const el = document.getElementById(item.id)
        return el ? [{ id: item.id, top: el.getBoundingClientRect().top }] : []
      })
      const doc = document.documentElement
      const next = readingHeadingIds(
        headings,
        scrollOffset() + 8,
        window.innerHeight,
        window.innerHeight + window.scrollY >= doc.scrollHeight - 48,
      )
      if (next)
        setReading((previous) =>
          previous.activeId === next.activeId &&
          previous.ids.join('\0') === next.ids.join('\0')
            ? previous
            : next,
        )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(resolve)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    const body = document.getElementById('article-body')
    if (body) observer.observe(body)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [toc])

  function scrollTo(item: TocItem) {
    const behavior = reducedMotion() ? 'instant' : 'smooth'
    if (item.id === 'article-top') {
      window.scrollTo({ top: 0, behavior })
      history.replaceState(history.state, '', location.pathname + location.search)
    } else {
      const el = document.getElementById(item.id)
      if (!el) return
      const y = window.scrollY + el.getBoundingClientRect().top - scrollOffset()
      window.scrollTo({ top: Math.max(0, y), behavior })
      history.replaceState(null, '', `#${encodeURIComponent(item.id)}`)
    }
    setReading({ activeId: item.id, ids: [item.id] })
  }

  let sectionNumber = 0
  const mizuki = variant === 'mizuki'
  return (
    <section
      ref={cardRef}
      className={cn('toc-card', mizuki ? 'mz-widget' : 'chirpy-toc mb-6')}
      id="toc-wrapper"
      aria-label="目录"
    >
      <h2 className={mizuki ? 'mz-widget-title' : 'chirpy-panel-heading'}>
        目录
      </h2>
      <nav ref={outlineRef} className="toc-outline" aria-label="文章目录">
        <div
          ref={highlightRef}
          className="toc-reading-range"
          aria-hidden="true"
        />
        <ul className="toc-outline-list">
          {toc.map((item, index) => {
            const root = item.level === minLevel
            if (root) sectionNumber += 1
            const shown = visible(index)
            const hasChildren = toc[index + 1]?.level > item.level
            const inRange = reading.ids.includes(item.id)
            return (
              <li
                key={item.id}
                className={cn('toc-outline-row', inRange && 'is-reading')}
                data-toc-row={item.id}
                data-collapsed={!shown}
                aria-hidden={!shown || undefined}
                inert={!shown || undefined}
              >
                <div className="toc-row-inner">
                  <a
                    href={item.id === 'article-top' ? '#' : `#${item.id}`}
                    data-toc-id={item.id}
                    aria-current={
                      reading.activeId === item.id ? 'location' : undefined
                    }
                    className={cn(
                      'toc-outline-link',
                      root && 'is-root',
                      reading.activeId === item.id && 'is-active',
                    )}
                    style={{
                      paddingLeft: `${0.65 + Math.max(0, item.level - minLevel) * 0.8}rem`,
                    }}
                    onClick={(event) => {
                      event.preventDefault()
                      scrollTo(item)
                    }}
                  >
                    <span
                      className={
                        root ? 'toc-section-number' : 'toc-section-dot'
                      }
                      aria-hidden="true"
                    >
                      {root ? sectionNumber : ''}
                    </span>
                    <span>{item.text}</span>
                  </a>
                  {hasChildren && (
                    <button
                      type="button"
                      className={cn(
                        'toc-outline-toggle',
                        open[item.id] === false && 'is-collapsed',
                      )}
                      aria-label={`${open[item.id] === false ? '展开' : '收起'}目录：${item.text}`}
                      aria-expanded={open[item.id] !== false}
                      onClick={() =>
                        setOpen((old) => ({
                          ...old,
                          [item.id]: old[item.id] === false,
                        }))
                      }
                    >
                      ▾
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </nav>
    </section>
  )
}
