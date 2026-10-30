'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  createContext, lazy, Suspense, useCallback, useContext,
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode,
} from 'react'
import { canPrefetchArticle, createArticleIntent } from '@/lib/article-prefetch'
import { warmArticleResources, warmPageLoadingResources } from '@/lib/article-resource-warmup'
import { ARTICLE_ENTRANCE_EVENT, BLOG_MOTION } from '@/lib/blog-motion-events'
import { readArticlePreview, saveArticlePreview, type ArticlePreview } from '@/lib/article-preview'
import { flushSync } from 'react-dom'
import { isArticlePathname, isBlogPathname } from '@/lib/blog-route'
import { ArticleHeading, ArticleHeadingMotion, type ArticleHeadingEntrance } from './article-heading'
import { MizukiArticleCard } from './article-card-surface'
import { forgetBlogPage, loadBlogPage } from '@/lib/blog-page-client'
import type { BlogPageResponse } from '@/lib/blog-page'
import { BlogPageView } from './blog-page-view'

type Navigate = (href: string, options?: { scroll?: boolean; replace?: boolean; articleSlug?: string; traversal?: boolean; fresh?: boolean }) => void
type Fallback = { pathname: string; preview: ArticlePreview | null; exited: boolean; feedOnly: boolean; feedTop: number }
type Current = { pathname: string; search: string; result: BlogPageResponse | null; error: string | null; version: number }
const Navigation = createContext<{ navigate: Navigate; pendingHref: string | null; fallback: Fallback | null; current: Current } | null>(null)
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const historyId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

// A tiny built-in frame covers clicks that beat background chunk warmup.
function ImmediateLoadingFrame({ preview, pathname }: Fallback) {
  if (!preview) return <div className="mz-page-loading mz-inline-loading" role="status" aria-label="页面加载中" aria-busy="true">
    <div className="mz-loading-lines" aria-hidden="true">{[100, 92, 76].map((width) => <div key={width} className="mz-skeleton mz-skeleton-line" style={{ width: `${width}%` }} />)}</div>
  </div>
  return <div className="mz-page-loading"><MizukiArticleCard pathname={pathname} loading role="status" aria-label="页面加载中" aria-busy="true">
    <header className="mz-article-header">{preview?.title ? <ArticleHeading title={preview.title} pathname={pathname} /> : <div className="mz-skeleton mz-skeleton-title" />}</header>
    <div className="mz-loading-lines" aria-hidden="true">{[100, 96, 80, 100, 90, 72].map((width, index) => <div key={index} className="mz-skeleton mz-skeleton-line" style={{ width: `${width}%` }} />)}</div>
  </MizukiArticleCard></div>
}
const LoadingFrame = lazy(() => warmPageLoadingResources()
  .then((module) => ({ default: module.PageLoadingFrame }))
  .catch(() => ({ default: ImmediateLoadingFrame })))

/** Initial children are SSR HTML; later pages are rendered from JSON in this outlet. */
export function BlogPageContent({ children }: { children: ReactNode }) {
  const navigation = useContext(Navigation)
  const fallback = navigation?.fallback
  const current = navigation?.current
  const feedWaiting = !!fallback?.exited && fallback.feedOnly
  return <div className={`mz-navigation-stage${fallback?.exited ? ' is-waiting' : ''}${feedWaiting ? ' is-feed-waiting' : ''}`}>
    <div className="blog-page-transition" hidden={!!fallback?.exited && !fallback.feedOnly}>
      {current?.error ? <div className="mz-empty" role="alert"><p>{current.error}</p><button type="button" onClick={() => navigation?.navigate(current.pathname + current.search, { replace: true, fresh: true })}>重试</button></div>
        : current?.result ? <BlogPageView data={current.result.page} /> : children}
    </div>
    {fallback && <div className="mz-navigation-underlay" aria-hidden={!fallback.exited}
      style={fallback.feedOnly ? { top: fallback.feedTop } : undefined}>
      <Suspense fallback={<ImmediateLoadingFrame {...fallback} />}><LoadingFrame {...fallback} /></Suspense>
    </div>}
  </div>
}

/** SSR boots the page once. In-session routing uses only History + the JSON API. */
export function BlogNavigationProvider({ children }: { children: ReactNode }) {
  const initialPathname = usePathname()
  const initialSearch = useSearchParams().toString()
  const [current, setCurrent] = useState<Current>({ pathname: initialPathname, search: initialSearch ? `?${initialSearch}` : '', result: null, error: null, version: 0 })
  const sequence = useRef(0)
  const animations = useRef<Animation[]>([])
  const recovery = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNavigation = useRef<(() => void) | null>(null)
  const previousPath = useRef<string | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [fallback, setFallback] = useState<Fallback | null>(null)
  const [headingEntrance, setHeadingEntrance] = useState<ArticleHeadingEntrance | null>(null)
  const destination = useRef<{ href: string; exited: boolean } | null>(null)
  const scrollTarget = useRef<{ position?: { x: number; y: number }; scroll: boolean } | null>(null)
  const historyKey = useRef('')
  const positions = useRef(new Map<string, { x: number; y: number }>())

  const reset = useCallback(() => {
    sequence.current++
    setPendingHref(null)
    setFallback(null)
    destination.current = null
    document.querySelector('.mz-shell')?.removeAttribute('data-blog-navigating')
    pendingNavigation.current = null
    if (recovery.current) clearTimeout(recovery.current)
    recovery.current = null
    animations.current.forEach((animation) => animation.cancel())
    animations.current = []
  }, [])

  const enter = useCallback((animate = true) => {
    const feedOnly = previousPath.current === '/' && location.pathname === '/'
    previousPath.current = location.pathname
    const requested = destination.current
    reset()
    if (!animate) return
    if (!requested) setHeadingEntrance({ pathname: location.pathname, startedAt: performance.now() })
    document.querySelector<HTMLElement>('.mz-shell')?.setAttribute('data-blog-transitions', '')
    const content = document.querySelector<HTMLElement>('.mz-content')
    if (!content || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const routeContent = content.querySelector<HTMLElement>('.blog-page-transition') || content
    const surface = feedOnly ? routeContent.querySelector<HTMLElement>('[data-feed-list]') || routeContent : routeContent
    // Article blocks own their entrance. Do not fade their parent too: stacking
    // opacity animations would keep ready content invisible for longer.
    const article = routeContent.querySelector('.mz-article > header')
    if (!article) animations.current.push(surface.animate(
      [{ opacity: 0, translate: feedOnly ? '0 6px' : '0 12px' }, { opacity: 1, translate: '0 0' }],
      { duration: BLOG_MOTION.pageEnter, easing: EASE, fill: 'backwards' },
    ))
    if (!feedOnly) {
      const sidebar = document.querySelector<HTMLElement>('.mz-sidebar')
      if (sidebar) animations.current.push(sidebar.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: BLOG_MOTION.pageEnter, delay: 50, easing: EASE, fill: 'backwards' },
      ))
    }
    if (article) window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
  }, [reset])

  useLayoutEffect(() => {
    const target = scrollTarget.current
    scrollTarget.current = null
    if (target && location.hash) {
      let id = location.hash.slice(1)
      try { id = decodeURIComponent(id) } catch { /* Preserve a malformed fragment. */ }
      document.getElementById(id)?.scrollIntoView()
    } else if (target?.position) window.scrollTo({ left: target.position.x, top: target.position.y, behavior: 'instant' })
    else if (target?.scroll) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.querySelector('.mz-shell')?.removeAttribute('data-blog-restoring')
    // Body entrance measures the visible viewport synchronously. Dispatch only
    // after scrolling and restoration finish, in this same pre-paint commit.
    enter(current.version > 0)
  }, [current.version, enter])

  const navigate = useCallback<Navigate>((href, options = {}) => {
    const url = new URL(href, window.location.href)
    const content = document.querySelector<HTMLElement>('.mz-content')
    const samePage = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search
    const outsideBlog = !isBlogPathname(url.pathname)
    if (samePage && !options.fresh && !options.traversal) {
      // Re-selecting the current tab can cancel an outgoing transition midway.
      const fading = (content && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? [...document.querySelectorAll<HTMLElement>('.blog-page-transition, [data-feed-list], .mz-sidebar')] : [])
        .map((element) => ({ element, opacity: getComputedStyle(element).opacity, translate: getComputedStyle(element).translate }))
        .filter((state) => Number(state.opacity) < 0.999)
      reset()
      for (const state of fading) animations.current.push(state.element.animate(
        [{ opacity: state.opacity, translate: state.translate === 'none' ? '0 0' : state.translate }, { opacity: 1, translate: '0 0' }],
        { duration: BLOG_MOTION.exit, easing: EASE, fill: 'backwards' },
      ))
      if (url.hash !== location.hash) {
        positions.current.set(historyKey.current, { x: window.scrollX, y: window.scrollY })
        const key = options.replace ? historyKey.current : historyId()
        const state = { ...window.history.state, __NA: true, __windBlog: key }
        if (options.replace) window.history.replaceState(state, '', url)
        else window.history.pushState(state, '', url)
        historyKey.current = key
      }
      if (url.hash) {
        let anchor = url.hash.slice(1)
        try { anchor = decodeURIComponent(anchor) } catch { /* Keep the original fragment. */ }
        document.getElementById(anchor)?.scrollIntoView()
      } else if (href.includes('#')) window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    if (outsideBlog || url.origin !== location.origin) {
      reset()
      if (options.replace) window.location.replace(href)
      else window.location.assign(href)
      return
    }
    if (!options.traversal && historyKey.current) positions.current.set(historyKey.current, { x: window.scrollX, y: window.scrollY })
    const wasWaiting = !!destination.current?.exited
    const feedOnly = url.pathname === '/' && previousPath.current === '/'
    const routeContent = content?.querySelector<HTMLElement>('.blog-page-transition') || content
    const surface = feedOnly ? routeContent?.querySelector<HTMLElement>('[data-feed-list]') || routeContent : routeContent
    const current = surface ? getComputedStyle(surface) : null
    const from = { opacity: current?.opacity || '1', translate: current?.translate === 'none' ? '0 0' : current?.translate || '0 0' }
    reset()
    setPendingHref(href)
    const active = { href, exited: false }
    destination.current = active
    document.querySelector('.mz-shell')?.setAttribute('data-blog-navigating', '')
    const id = sequence.current
    let slug = options.articleSlug || url.pathname.slice(1)
    try { slug = decodeURIComponent(slug) } catch { /* A malformed URL still gets a loading frame. */ }
    const stage = routeContent?.closest('.mz-navigation-stage')
    const frame: Fallback = { pathname: url.pathname, preview: isArticlePathname(url.pathname) ? readArticlePreview(slug) : null,
      exited: false, feedOnly, feedTop: feedOnly && surface && stage ? surface.getBoundingClientRect().top - stage.getBoundingClientRect().top : 0 }
    // Prepare the fallback out of sight. aria-hidden alone is not visual hiding:
    // CSS also gates this surface until the exit has actually finished.
    flushSync(() => setFallback(frame))
    let result: BlogPageResponse | null = null
    let error: string | null = null
    let ready = false
    let presented = false
    const present = () => {
      if (presented || !ready || !active.exited || sequence.current !== id || destination.current !== active) return
      presented = true
      const next = new URL(result?.href || href, window.location.href)
      next.hash = url.hash
      const key = options.traversal ? window.history.state?.__windBlog : options.replace ? historyKey.current : historyId()
      const state = { ...window.history.state, __NA: true, __windBlog: key }
      // __NA bypasses Next's patched pushState/replaceState. This router owns
      // both the visible URL and the client outlet; no RSC tree is restored.
      if (options.replace || options.traversal) window.history.replaceState(state, '', next)
      else window.history.pushState(state, '', next)
      historyKey.current = key
      scrollTarget.current = { position: options.traversal ? positions.current.get(key) : undefined, scroll: options.scroll !== false }
      document.title = result?.title || '页面加载失败'
      forgetBlogPage(href)
      // Reveal the committed destination in the same render so scroll restoration
      // measures its real height rather than the hidden loading outlet.
      setFallback(null)
      setCurrent((previous) => ({ pathname: next.pathname, search: next.search, result, error, version: previous.version + 1 }))
    }
    const completeExit = () => {
      if (sequence.current !== id || destination.current !== active || active.exited) return
      active.exited = true
      pendingNavigation.current = null
      flushSync(() => {
        setHeadingEntrance({ pathname: url.pathname, startedAt: performance.now(), title: frame.preview?.title })
        setFallback({ ...frame, exited: true })
      })
      present()
    }
    pendingNavigation.current = completeExit
    void loadBlogPage(href, options.fresh || options.traversal).then((value) => {
      result = value; ready = true; present()
    }, (reason) => {
      error = reason instanceof Error ? reason.message : '页面加载失败，请重试'; ready = true; present()
    })
    void warmPageLoadingResources().catch(() => {})
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || wasWaiting
    if (surface && !reduced) {
      const exit = surface.animate(
        [from, { opacity: 0, translate: feedOnly ? '0 2px' : '0 4px' }],
        { duration: BLOG_MOTION.exit, easing: EASE, fill: 'both' },
      )
      animations.current.push(exit)
      void exit.finished.then(completeExit).catch(() => { /* Superseded navigation. */ })
    }
    if (!feedOnly && !reduced) {
      const sidebar = document.querySelector<HTMLElement>('.mz-sidebar')
      if (sidebar) animations.current.push(sidebar.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: BLOG_MOTION.exit, easing: EASE, fill: 'forwards' },
      ))
    }
    // Failed or cancelled navigation must never strand the page at opacity zero.
    recovery.current = setTimeout(() => {
      error = '页面加载超时，请重试'; ready = true
      completeExit(); present()
    }, 15000)
    if (!surface || reduced) completeExit()
  }, [reset])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => {
      if (!media.matches) return
      pendingNavigation.current?.()
      animations.current.forEach((animation) => animation.cancel())
      animations.current = []
    }
    const key = window.history.state?.__windBlog || historyId()
    historyKey.current = key
    window.history.replaceState({ ...window.history.state, __NA: true, __windBlog: key }, '')
    const oldRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const save = () => {
      if (!destination.current) positions.current.set(historyKey.current, { x: window.scrollX, y: window.scrollY })
    }
    const restore = (event: PopStateEvent) => {
      if (!event.state?.__windBlog) return
      // Capture before Next's bubbling listener can restore an obsolete RSC tree.
      event.stopImmediatePropagation()
      document.querySelector('.mz-shell')?.setAttribute('data-blog-restoring', '')
      navigate(location.pathname + location.search + location.hash, { traversal: true, fresh: true })
    }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('.mz-shell a[href]') : null
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin || !isBlogPathname(url.pathname)) return
      event.preventDefault()
      navigate(url.pathname + url.search + url.hash)
    }
    media.addEventListener('change', reduce)
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('popstate', restore, true)
    window.addEventListener('click', click)
    return () => {
      media.removeEventListener('change', reduce)
      window.removeEventListener('scroll', save)
      window.removeEventListener('popstate', restore, true)
      window.removeEventListener('click', click)
      window.history.scrollRestoration = oldRestoration
      reset()
    }
  }, [reset, navigate])

  const value = useMemo(() => ({ navigate, pendingHref, fallback, current }), [navigate, pendingHref, fallback, current])
  return (
    <Navigation.Provider value={value}>
      <ArticleHeadingMotion.Provider value={headingEntrance}>
      {children}
      </ArticleHeadingMotion.Provider>
    </Navigation.Provider>
  )
}

/** Native anchors preserve downloads, new tabs and the SSR fallback without Next prefetch. */
export default function BlogLink({ onNavigate, onClick, href, replace, scroll, prefetch, articleSlug,
  onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur, ...props
}: Omit<ComponentProps<'a'>, 'href'> & { href: string; replace?: boolean; scroll?: boolean; prefetch?: boolean; articleSlug?: string; onNavigate?: (event: { preventDefault: () => void }) => void }) {
  const navigation = useContext(Navigation)
  const intent = useMemo(() => createArticleIntent((immediate) => {
    if (!articleSlug || (!immediate && !canPrefetchArticle())) return
    void warmArticleResources().catch(() => {})
    void loadBlogPage(`/${articleSlug}`).catch(() => {})
  }), [articleSlug])
  useEffect(() => intent.cancel, [intent])
  return <a {...props} href={href}
    onClick={(event) => {
      onClick?.(event)
      if (articleSlug && !event.defaultPrevented && event.button === 0 &&
          !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !readArticlePreview(articleSlug)) {
        saveArticlePreview({ slug: articleSlug, title: event.currentTarget.title || event.currentTarget.textContent?.trim() || '', summary: '', publishedLabel: '', categoryName: '' })
      }
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          (props.target && props.target !== '_self') || props.download !== undefined || !navigation) return
      const url = new URL(href, location.href)
      if (url.origin !== location.origin || !isBlogPathname(url.pathname)) return
      let prevented = false
      onNavigate?.({ preventDefault: () => { prevented = true } })
      if (prevented) { event.preventDefault(); return }
      event.preventDefault()
      navigation.navigate(href, { replace, scroll, articleSlug })
    }}
    onPointerEnter={(event) => { onPointerEnter?.(event); if (articleSlug && event.pointerType !== 'touch') intent.schedule() }}
    onPointerLeave={(event) => { onPointerLeave?.(event); intent.cancel() }}
    onPointerDown={(event) => {
      onPointerDown?.(event)
      if (articleSlug && !event.defaultPrevented && event.button === 0 && event.pointerType !== 'touch' &&
          !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) intent.activate()
    }}
    onFocus={(event) => { onFocus?.(event); if (articleSlug) intent.schedule() }}
    onBlur={(event) => { onBlur?.(event); intent.cancel() }}
  />
}

export function useBlogRouter() {
  const navigation = useContext(Navigation)
  const navigate = navigation?.navigate
  const refresh = useCallback(() => navigate?.(location.pathname + location.search + location.hash, { replace: true, fresh: true, scroll: false }), [navigate])
  return {
    push: (href: string, options?: { scroll?: boolean }) => navigation ? navigation.navigate(href, options) : window.location.assign(href),
    replace: (href: string, options?: { scroll?: boolean }) => navigation ? navigation.navigate(href, { ...options, replace: true }) : window.location.replace(href),
    refresh,
  }
}

export function useBlogPathname() {
  const initial = usePathname()
  return useContext(Navigation)?.current.pathname || initial
}

export function useBlogSearchParams() {
  const initial = useSearchParams()
  const navigation = useContext(Navigation)
  return new URLSearchParams(navigation ? navigation.current.search : initial.toString())
}

export function usePendingBlogHref() {
  return useContext(Navigation)?.pendingHref || null
}
