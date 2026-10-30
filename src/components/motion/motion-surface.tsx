'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import gsap from 'gsap'
import { createPortal } from 'react-dom'
import { usePendingBlogHref } from '@/components/blog/blog-navigation'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const targets = {
  blog: '[data-comment-row]',
  admin:
    '[data-slot="card"], [data-slot="empty"], [data-slot="table-body"] > tr, [data-motion-item]',
}

function Surface({ mode }: { mode: 'blog' | 'admin' }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const pendingHref = usePendingBlogHref()
  const route = pathname + '?' + params.toString() + (mode === 'blog' ? `|${pendingHref || ''}` : '')
  const bar = useRef<HTMLDivElement>(null)
  const reading = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const [navHost, setNavHost] = useState<HTMLElement | null>(null)
  const pending = useRef(false)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frame = useRef(0)
  const selector =
    mode === 'blog' ? '[data-blog-theme="mizuki"]' : '[data-blog-admin]'

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(selector)
    const host = root?.querySelector<HTMLElement>(
      mode === 'blog' ? '.mz-nav-links' : '[data-sidebar="content"]',
    )
    if (!host) return
    setNavHost(host)
    return () => {
      host.removeAttribute('data-motion-nav')
    }
  }, [selector, mode])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(selector)
    if (!root) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const seen = new WeakSet<HTMLElement>()
    const animations = new Set<Animation>()
    const scan = () => {
      let index = 0
      root.querySelectorAll<HTMLElement>(targets[mode]).forEach((el) => {
        if (seen.has(el) || !el.getClientRects().length) return
        seen.add(el)
        el.dataset.motionReveal = ''
        if (media.matches) return
        // Animate on mount/data update only. Scrolling never hides or reveals content.
        const animation = el.animate(
          [
            { opacity: 0, translate: '0 12px' },
            { opacity: 1, translate: '0 0' },
          ],
          {
            duration: 380,
            delay: Math.min(index++, 5) * 35,
            easing: EASE,
            fill: 'backwards',
          },
        )
        animations.add(animation)
        animation.onfinish = () => animations.delete(animation)
        animation.oncancel = () => animations.delete(animation)
      })
    }
    let scanFrame = 0
    const mutations = new MutationObserver((records) => {
      if (
        !records.some((record) =>
          [...record.addedNodes].some((node) => node.nodeType === 1),
        )
      )
        return
      if (!scanFrame)
        scanFrame = requestAnimationFrame(() => {
          scanFrame = 0
          scan()
        })
    })
    scan()
    mutations.observe(root, { childList: true, subtree: true })
    const reduce = () => {
      if (media.matches) animations.forEach((animation) => animation.cancel())
    }
    media.addEventListener('change', reduce)
    return () => {
      mutations.disconnect()
      cancelAnimationFrame(scanFrame)
      animations.forEach((animation) => animation.cancel())
      media.removeEventListener('change', reduce)
    }
  }, [selector, mode, route])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(selector)
    if (!root) return
    const reduced = () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      root.removeAttribute('data-navigating')
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      pending.current = false
      if (bar.current)
        gsap.to(bar.current, {
          scaleX: 1,
          opacity: 0,
          duration: 0.25,
          overwrite: true,
        })
    }
    const click = (event: MouseEvent) => {
      if (mode === 'blog') return // BlogNavigationProvider owns the page transition.
      if (
        event.defaultPrevented ||
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null
      if (
        !link ||
        !root.contains(link) ||
        link.target ||
        link.hasAttribute('download')
      )
        return
      const url = new URL(link.href, location.href)
      if (
        url.origin !== location.origin ||
        (url.pathname === location.pathname && url.search === location.search)
      )
        return
      if (reduced()) return
      pending.current = true
      root.dataset.navigating = ''
      if (bar.current)
        gsap.fromTo(
          bar.current,
          { scaleX: 0.02, opacity: 1 },
          { scaleX: 0.88, duration: 1.8, ease: 'power2.out', overwrite: true },
        )
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      // A cancelled confirmation or same-route action must never leave a dim page.
      pendingTimer.current = setTimeout(finish, 1600)
    }
    root.addEventListener('click', click, true)
    return () => {
      root.removeEventListener('click', click, true)
      finish()
      if (bar.current) gsap.killTweensOf(bar.current)
    }
  }, [selector, mode])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(selector)
    root?.removeAttribute('data-navigating')
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    if (pending.current && bar.current) {
      pending.current = false
      gsap.to(bar.current, {
        scaleX: 1,
        duration: 0.15,
        overwrite: true,
        onComplete: () => {
          if (bar.current) gsap.to(bar.current, { opacity: 0, duration: 0.18 })
        },
      })
    }
    // One floating marker follows the selected navigation item, including Tabs.
    const update = () => {
      frame.current = 0
      if (!root || !indicator.current || !navHost) return
      const active = root.querySelector<HTMLElement>(
        mode === 'blog'
          ? '.mz-nav-links .mz-nav-link.is-active'
          : '[data-sidebar="menu-sub-button"][data-active="true"], [data-sidebar="menu-button"][data-active="true"]',
      )
      const rect = active?.getBoundingClientRect()
      if (!rect || !rect.width || rect.bottom < 0 || rect.top > innerHeight) {
        // Fade out in place so leaving a nav section doesn't blink the bar.
        gsap.to(indicator.current, { opacity: 0, duration: 0.18, ease: 'power1.out', overwrite: true })
        return
      }
      const hostRect = navHost.getBoundingClientRect()
      const position = {
        x: rect.left - hostRect.left + navHost.scrollLeft,
        y: rect.top - hostRect.top + navHost.scrollTop,
        width: rect.width,
        height: rect.height,
        opacity: 1,
      }
      if (!navHost.hasAttribute('data-motion-nav')) {
        // Keep the server-rendered selected background until its replacement
        // has a real position. The first marker never flies in from (0, 0).
        gsap.set(indicator.current, position)
        navHost.dataset.motionNav = ''
      } else gsap.to(indicator.current, {
        ...position,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 0.28,
        ease: 'power3.out',
        overwrite: true,
      })
    }
    const schedule = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    if (root) {
      observer.observe(root)
      root
        .querySelectorAll('[data-sidebar="menu-sub"]')
        .forEach((el) => observer.observe(el))
    }
    // Expansion changes the active item's position without changing the route.
    const changes = new MutationObserver(schedule)
    if (root)
      changes.observe(root, {
        attributes: true,
        attributeFilter: ['data-state', 'data-active'],
        subtree: true,
      })
    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      observer.disconnect()
      changes.disconnect()
      cancelAnimationFrame(frame.current)
      frame.current = 0
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      if (indicator.current) gsap.killTweensOf(indicator.current)
    }
  }, [route, selector, mode, navHost])

  useEffect(() => {
    if (mode !== 'blog') return
    let raf = 0
    const update = () => {
      raf = 0
      const article = document.getElementById('article-body')
      if (!reading.current) return
      reading.current.hidden = !article
      if (!article) return
      const rect = article.getBoundingClientRect()
      const range = Math.max(1, rect.height - innerHeight + 100)
      const progress = Math.max(0, Math.min(1, (100 - rect.top) / range))
      reading.current.style.transform = `scaleX(${progress})`
      reading.current.setAttribute(
        'aria-valuenow',
        String(Math.round(progress * 100)),
      )
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    schedule()
    const resize = new ResizeObserver(schedule)
    const root = document.querySelector(selector)
    if (root) resize.observe(root)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [mode, route, selector])

  return (
    <>
      <div ref={bar} className="motion-route-progress" aria-hidden="true" />
      {navHost &&
        createPortal(
          <div
            ref={indicator}
            className={`motion-nav-indicator motion-nav-${mode}`}
            aria-hidden="true"
          />,
          navHost,
        )}
      {mode === 'blog' && (
        <div
          ref={reading}
          className="motion-reading-progress"
          role="progressbar"
          aria-label="文章阅读进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          hidden
        />
      )}
    </>
  )
}

export function MotionSurface({ mode }: { mode: 'blog' | 'admin' }) {
  return (
    <Suspense fallback={null}>
      <Surface mode={mode} />
    </Suspense>
  )
}
