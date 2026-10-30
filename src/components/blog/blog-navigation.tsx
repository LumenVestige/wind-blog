'use client'

import NextLink from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  createContext, lazy, startTransition, Suspense, useCallback, useContext,
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode,
} from 'react'
import { canPrefetchArticle, createArticleIntent } from '@/lib/article-prefetch'
import { warmArticleResources, warmPageLoadingResources } from '@/lib/article-resource-warmup'
import { ARTICLE_ENTRANCE_EVENT, BLOG_MOTION } from '@/lib/blog-motion-events'
import { readArticlePreview, saveArticlePreview, type ArticlePreview } from '@/lib/article-preview'
import { flushSync } from 'react-dom'
import { isArticlePathname } from '@/lib/blog-route'
import { ArticleHeading, ArticleHeadingMotion, type ArticleHeadingEntrance } from './article-heading'
import { MizukiArticleCard } from './article-card-surface'

type Navigate = (href: string, options?: { scroll?: boolean; replace?: boolean; articleSlug?: string }) => void
type Fallback = { pathname: string; preview: ArticlePreview | null; exited: boolean; feedOnly: boolean; feedTop: number }
const Navigation = createContext<{ navigate: Navigate; pendingHref: string | null; fallback: Fallback | null } | null>(null)
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

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

/** The actual route may still be streaming after the outgoing motion ends. */
export function BlogPageContent({ children }: { children: ReactNode }) {
  const fallback = useContext(Navigation)?.fallback
  const feedWaiting = !!fallback?.exited && fallback.feedOnly
  return <div className={`mz-navigation-stage${fallback?.exited ? ' is-waiting' : ''}${feedWaiting ? ' is-feed-waiting' : ''}`}>
    <div className="blog-page-transition" hidden={!!fallback?.exited && !fallback.feedOnly}>{children}</div>
    {fallback && <div className="mz-navigation-underlay" aria-hidden={!fallback.exited}
      style={fallback.feedOnly ? { top: fallback.feedTop } : undefined}>
      <Suspense fallback={<ImmediateLoadingFrame {...fallback} />}><LoadingFrame {...fallback} /></Suspense>
    </div>}
  </div>
}

function RouteObserver({ onCommit }: { onCommit: (animate: boolean) => void }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const committed = useRef<string | null>(null)
  // Search-only changes (sort, filters and pagination) need the same entrance.
  useLayoutEffect(() => {
    const route = `${pathname}?${search}`
    if (committed.current === route) return
    const initial = committed.current === null
    committed.current = route
    // SSR content is already visible. Hydration (including Strict Mode's
    // repeated effects) must never hide it just to replay an entrance.
    onCommit(!initial)
  }, [pathname, search, onCommit])
  return null
}

/** Prefetch/data work starts on click; route presentation waits for the exit. */
export function BlogNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const sequence = useRef(0)
  const animations = useRef<Animation[]>([])
  const recovery = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNavigation = useRef<(() => void) | null>(null)
  const previousPath = useRef<string | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [fallback, setFallback] = useState<Fallback | null>(null)
  const [headingEntrance, setHeadingEntrance] = useState<ArticleHeadingEntrance | null>(null)
  const destination = useRef<{ href: string; exited: boolean; committed: boolean } | null>(null)

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

  const commit = useCallback((animate = true) => {
    const active = destination.current
    if (active) {
      const target = new URL(active.href, location.href)
      if (target.pathname === location.pathname && target.search === location.search) {
        active.committed = true
        if (!active.exited) return
      }
    }
    enter(animate)
  }, [enter])

  const navigate = useCallback<Navigate>((href, options = {}) => {
    const url = new URL(href, window.location.href)
    const push = () => startTransition(() => {
      if (options.replace) router.replace(href, { scroll: options.scroll })
      else router.push(href, { scroll: options.scroll })
    })
    const content = document.querySelector<HTMLElement>('.mz-content')
    const samePage = url.pathname === location.pathname && url.search === location.search
    const outsideBlog = /^\/(manage|dashboard|login|setup|api|user|_next)(\/|$)/.test(url.pathname)
    if (samePage && content && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Re-selecting the current tab can cancel an outgoing transition midway.
      const fading = [...document.querySelectorAll<HTMLElement>('.blog-page-transition, [data-feed-list], .mz-sidebar')]
        .map((element) => ({ element, opacity: getComputedStyle(element).opacity, translate: getComputedStyle(element).translate }))
        .filter((state) => Number(state.opacity) < 0.999)
      reset()
      for (const state of fading) animations.current.push(state.element.animate(
        [{ opacity: state.opacity, translate: state.translate === 'none' ? '0 0' : state.translate }, { opacity: 1, translate: '0 0' }],
        { duration: BLOG_MOTION.exit, easing: EASE, fill: 'backwards' },
      ))
      push()
      return
    }
    if (samePage || outsideBlog || url.origin !== location.origin) {
      reset()
      if (!samePage) setPendingHref(href)
      push()
      return
    }
    const wasWaiting = !!destination.current?.exited
    const feedOnly = url.pathname === '/' && location.pathname === '/'
    const routeContent = content?.querySelector<HTMLElement>('.blog-page-transition') || content
    const surface = feedOnly ? routeContent?.querySelector<HTMLElement>('[data-feed-list]') || routeContent : routeContent
    const current = surface ? getComputedStyle(surface) : null
    const from = { opacity: current?.opacity || '1', translate: current?.translate === 'none' ? '0 0' : current?.translate || '0 0' }
    reset()
    setPendingHref(href)
    const active = { href, exited: false, committed: false }
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
    const completeExit = () => {
      if (sequence.current !== id || destination.current !== active || active.exited) return
      active.exited = true
      pendingNavigation.current = null
      if (active.committed) { enter(); return }
      flushSync(() => {
        setHeadingEntrance({ pathname: url.pathname, startedAt: performance.now(), title: frame.preview?.title })
        setFallback({ ...frame, exited: true })
      })
      // Keep outgoing surfaces at opacity zero while data is pending. Cancelling
      // their fill here would flash the old sidebar back to full opacity.
      // The route was already prefetched during the exit. Committing it now
      // prevents fast responses from replacing the outgoing page mid-animation.
      push()
    }
    pendingNavigation.current = completeExit
    router.prefetch(href)
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
    recovery.current = setTimeout(enter, 8000)
    // Route prefetch, reading resources and article data started with the click.
    // Only the visible route commit is held until the outgoing motion completes.
    if (!surface || reduced) completeExit()
  }, [router, reset, enter])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => {
      if (!media.matches) return
      pendingNavigation.current?.()
      animations.current.forEach((animation) => animation.cancel())
      animations.current = []
    }
    media.addEventListener('change', reduce)
    window.addEventListener('popstate', reset)
    return () => {
      media.removeEventListener('change', reduce)
      window.removeEventListener('popstate', reset)
      reset()
    }
  }, [reset])

  const value = useMemo(() => ({ navigate, pendingHref, fallback }), [navigate, pendingHref, fallback])
  return (
    <Navigation.Provider value={value}>
      <ArticleHeadingMotion.Provider value={headingEntrance}>
      {children}
      <Suspense fallback={null}><RouteObserver onCommit={commit} /></Suspense>
      </ArticleHeadingMotion.Provider>
    </Navigation.Provider>
  )
}

/** Native Next link semantics preserve modifier clicks, downloads and new tabs. */
export default function BlogLink({ onNavigate, onClick, href, replace, scroll, prefetch, articleSlug,
  onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur, ...props
}: ComponentProps<typeof NextLink> & { articleSlug?: string }) {
  const navigation = useContext(Navigation)
  const router = useRouter()
  const intent = useMemo(() => createArticleIntent((immediate) => {
    if (!articleSlug || (!immediate && !canPrefetchArticle())) return
    void warmArticleResources().catch(() => {})
    router.prefetch(`/${articleSlug}`)
  }), [articleSlug, router])
  useEffect(() => intent.cancel, [intent])
  return <NextLink {...props} href={href} replace={replace} scroll={scroll}
    prefetch={articleSlug ? false : prefetch}
    onClick={(event) => {
      onClick?.(event)
      if (articleSlug && !event.defaultPrevented && event.button === 0 &&
          !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !readArticlePreview(articleSlug)) {
        saveArticlePreview({ slug: articleSlug, title: event.currentTarget.title || event.currentTarget.textContent?.trim() || '', summary: '', publishedLabel: '', categoryName: '' })
      }
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
    onNavigate={(event) => {
    let prevented = false
    onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault() } })
    if (prevented) return
    if (articleSlug) {
      intent.activate()
    }
    if (!navigation || typeof href !== 'string') return
    event.preventDefault()
    navigation.navigate(href, { replace, scroll, articleSlug })
  }} />
}

export function useBlogRouter() {
  const router = useRouter()
  const navigation = useContext(Navigation)
  return {
    ...router,
    push: (href: string, options?: { scroll?: boolean }) => navigation ? navigation.navigate(href, options) : router.push(href, options),
  }
}

export function usePendingBlogHref() {
  return useContext(Navigation)?.pendingHref || null
}
