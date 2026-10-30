'use client'

import NextLink from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  createContext, startTransition, Suspense, useCallback, useContext,
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode,
} from 'react'
import { canPrefetchArticle, clearArticlePrefetch, createArticleIntent, prefetchArticle, prepareArticleForNavigation } from '@/lib/article-prefetch'
import { warmArticleResources } from '@/lib/article-resource-warmup'
import { ARTICLE_ENTRANCE_EVENT } from '@/lib/blog-motion-events'

type Navigate = (href: string, options?: { scroll?: boolean; replace?: boolean }) => void
const Navigation = createContext<{ navigate: Navigate; pendingHref: string | null } | null>(null)
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

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
    if (!initial) clearArticlePrefetch(pathname)
    // SSR content is already visible. Hydration (including Strict Mode's
    // repeated effects) must never hide it just to replay an entrance.
    onCommit(!initial)
  }, [pathname, search, onCommit])
  return null
}

/** Keep the shell mounted; finish the outgoing motion before handing off to Next. */
export function BlogNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const sequence = useRef(0)
  const animations = useRef<Animation[]>([])
  const recovery = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingNavigation = useRef<(() => void) | null>(null)
  const previousPath = useRef<string | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const reset = useCallback(() => {
    sequence.current++
    setPendingHref(null)
    pendingNavigation.current = null
    if (recovery.current) clearTimeout(recovery.current)
    recovery.current = null
    animations.current.forEach((animation) => animation.cancel())
    animations.current = []
  }, [])

  const enter = useCallback((animate = true) => {
    const feedOnly = previousPath.current === '/' && location.pathname === '/'
    previousPath.current = location.pathname
    reset()
    if (!animate) return
    document.querySelector<HTMLElement>('.mz-shell')?.setAttribute('data-blog-transitions', '')
    const content = document.querySelector<HTMLElement>('.mz-content')
    if (!content || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const surface = feedOnly ? content.querySelector<HTMLElement>('[data-feed-list]') || content : content
    // Article blocks own their entrance. Do not fade their parent too: stacking
    // opacity animations would keep ready content invisible for longer.
    const article = content.querySelector('.mz-article > header')
    if (!article) animations.current.push(surface.animate(
      [{ opacity: 0, translate: feedOnly ? '0 12px' : '0 32px' }, { opacity: 1, translate: '0 0' }],
      { duration: 300, easing: EASE, fill: 'backwards' },
    ))
    if (!feedOnly) {
      const sidebar = document.querySelector<HTMLElement>('.mz-sidebar')
      if (sidebar) animations.current.push(sidebar.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 300, delay: 50, easing: EASE, fill: 'backwards' },
      ))
    }
    if (article) window.dispatchEvent(new Event(ARTICLE_ENTRANCE_EVENT))
  }, [reset])

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
      const fading = [...document.querySelectorAll<HTMLElement>('.mz-content, [data-feed-list], .mz-sidebar')]
        .map((element) => ({ element, opacity: getComputedStyle(element).opacity, translate: getComputedStyle(element).translate }))
        .filter((state) => Number(state.opacity) < 0.999)
      reset()
      for (const state of fading) animations.current.push(state.element.animate(
        [{ opacity: state.opacity, translate: state.translate === 'none' ? '0 0' : state.translate }, { opacity: 1, translate: '0 0' }],
        { duration: 180, easing: EASE, fill: 'backwards' },
      ))
      push()
      return
    }
    if (!content || samePage || outsideBlog || url.origin !== location.origin ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reset()
      if (!samePage) setPendingHref(href)
      push()
      return
    }
    const feedOnly = url.pathname === '/' && location.pathname === '/'
    const surface = feedOnly ? content.querySelector<HTMLElement>('[data-feed-list]') || content : content
    const current = getComputedStyle(surface)
    const from = { opacity: current.opacity, translate: current.translate === 'none' ? '0 0' : current.translate }
    reset()
    setPendingHref(href)
    const id = sequence.current
    pendingNavigation.current = push
    router.prefetch(href)
    const exit = surface.animate(
      [from, { opacity: 0, translate: feedOnly ? '0 8px' : '0 16px' }],
      { duration: 180, easing: EASE, fill: 'both' },
    )
    animations.current.push(exit)
    if (!feedOnly) {
      const sidebar = document.querySelector<HTMLElement>('.mz-sidebar')
      if (sidebar) animations.current.push(sidebar.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 180, easing: EASE, fill: 'forwards' },
      ))
    }
    // Failed or cancelled navigation must never strand the page at opacity zero.
    recovery.current = setTimeout(enter, 8000)
    void exit.finished.then(() => {
      if (sequence.current === id) {
        pendingNavigation.current = null
        push()
      }
    }).catch(() => { /* Superseded by another navigation or history traversal. */ })
  }, [router, reset, enter])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => {
      if (!media.matches) return
      const push = pendingNavigation.current
      reset()
      push?.()
    }
    media.addEventListener('change', reduce)
    window.addEventListener('popstate', reset)
    return () => {
      media.removeEventListener('change', reduce)
      window.removeEventListener('popstate', reset)
      clearArticlePrefetch('')
      reset()
    }
  }, [reset])

  const value = useMemo(() => ({ navigate, pendingHref }), [navigate, pendingHref])
  return (
    <Navigation.Provider value={value}>
      {children}
      <Suspense fallback={null}><RouteObserver onCommit={enter} /></Suspense>
    </Navigation.Provider>
  )
}

/** Native Next link semantics preserve modifier clicks, downloads and new tabs. */
export default function BlogLink({ onNavigate, href, replace, scroll, prefetch, articleSlug,
  onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur, ...props
}: ComponentProps<typeof NextLink> & { articleSlug?: string }) {
  const navigation = useContext(Navigation)
  const router = useRouter()
  const intent = useMemo(() => createArticleIntent((immediate) => {
    if (!articleSlug || (!immediate && !canPrefetchArticle())) return
    void warmArticleResources().catch(() => {})
    router.prefetch(`/${articleSlug}`)
    void prefetchArticle(articleSlug, immediate)
  }), [articleSlug, router])
  useEffect(() => intent.cancel, [intent])
  return <NextLink {...props} href={href} replace={replace} scroll={scroll}
    prefetch={articleSlug ? false : prefetch}
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
      if (typeof href === 'string') {
        const destination = new URL(href, location.href)
        if (destination.origin === location.origin &&
            (destination.pathname !== location.pathname || destination.search !== location.search)) {
          prepareArticleForNavigation(articleSlug)
        }
      }
    }
    if (!navigation || typeof href !== 'string') return
    event.preventDefault()
    navigation.navigate(href, { replace, scroll })
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
