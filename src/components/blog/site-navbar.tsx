'use client'

import Link, { usePendingBlogHref } from '@/components/blog/blog-navigation'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Archive, ChevronDown, FolderOpen, Home, Info, ListTree, LogIn, Menu, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'
import type { BlogShellData } from './shell-types'
import type { TocItem } from './article-toc'

export type SiteNavbarData = Pick<
  BlogShellData,
  'siteName' | 'displayName' | 'avatar' | 'isOwner' | 'pages' | 'staticSites' | 'showFriends'
>

/**
 * App-wide top bar: brand, primary nav, theme toggle and owner/login entry.
 * Collapses the links into a menu whenever they no longer fit on one row.
 */
export function SiteNavbar({
  data,
  articleTitle = null,
  articleToc = [],
}: {
  data: SiteNavbarData
  /** Set on article pages; the brand swaps to it once the page title scrolls under the bar. */
  articleTitle?: string | null
  articleToc?: TocItem[]
}) {
  const pathname = usePathname()
  const pendingHref = usePendingBlogHref()
  const activePathname = pendingHref ? new URL(pendingHref, 'http://blog.local').pathname : pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const tocButtonRef = useRef<HTMLButtonElement>(null)
  const topRowRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const [titleDocked, setTitleDocked] = useState(false)
  const [titleWidth, setTitleWidth] = useState(0)
  const navInnerRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const navLinksRef = useRef<HTMLElement>(null)
  const navActionsRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMenuOpen(false)
    setTocOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!articleToc.length) setTocOpen(false)
  }, [articleToc.length])

  useEffect(() => {
    if (!tocOpen) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !topRowRef.current?.contains(event.target)) setTocOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setTocOpen(false)
      tocButtonRef.current?.focus()
    }
    const desktop = window.matchMedia('(min-width: 1024px)')
    const resize = () => { if (desktop.matches) setTocOpen(false) }
    desktop.addEventListener('change', resize)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      desktop.removeEventListener('change', resize)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [tocOpen])

  useEffect(() => {
    if (!compact) setMenuOpen(false)
  }, [compact])

  useEffect(() => {
    const inner = navInnerRef.current
    if (!inner) return
    const measure = () => {
      const brand = brandRef.current
      const links = navLinksRef.current
      const actions = navActionsRef.current
      if (!brand || !links || !actions) return
      const style = getComputedStyle(inner)
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const available = inner.clientWidth - padding
      const menuButton = menuButtonRef.current
      const menuWidth =
        menuButton && getComputedStyle(menuButton).display !== 'none' ? menuButton.offsetWidth : 0
      const required = brand.offsetWidth + links.scrollWidth + actions.offsetWidth - menuWidth + 24
      const isCompact = required > available
      setCompact(isCompact)
      // The docked title may run up to the links, or to the actions once the links fold away.
      const linksShown = !isCompact && getComputedStyle(links).visibility !== 'hidden'
      const limit = (linksShown ? links : actions).getBoundingClientRect().left
      setTitleWidth(Math.max(0, limit - brand.getBoundingClientRect().left - 16))
    }
    measure()
    const observer = new ResizeObserver(measure)
    const targets = [inner, brandRef.current, navLinksRef.current, navActionsRef.current]
    targets.forEach((el) => el && observer.observe(el))
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (!articleTitle) {
      setTitleDocked(false)
      return
    }
    let frame = 0
    const check = () => {
      frame = 0
      const heading = document.querySelector('.mz-article > header > h1')
      const bar = navInnerRef.current
      if (!heading || !bar) return setTitleDocked(false)
      setTitleDocked(heading.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [articleTitle, pathname])

  const navItems = [
    { href: '/', label: '首页', icon: Home, end: true },
    { href: '/archives', label: '归档', icon: Archive },
    ...(data.staticSites.length ? [{ href: '/static', label: '静态页', icon: FolderOpen }] : []),
    ...(data.showFriends ? [{ href: '/friends', label: '友链', icon: Users }] : []),
    { href: '/about', label: '关于', icon: Info },
  ]

  function active(href: string, end?: boolean) {
    return end ? activePathname === href : activePathname.startsWith(href)
  }

  const loginHref = `/login?next=${encodeURIComponent(pathname || '/')}`
  const tocBaseLevel = Math.min(...articleToc.map((heading) => heading.level))

  return (
    <div className={cn('mz-top-row', compact && 'is-compact')} ref={topRowRef}>
      <header className="mz-navbar" aria-label="导航">
        <div className="mz-nav-inner" ref={navInnerRef}>
          <div className={cn('mz-brand-slot', titleDocked && 'is-title')} ref={brandRef}>
            <Link href="/" className="mz-brand" inert={titleDocked || undefined}>
              {data.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.avatar} alt="" className="mz-brand-avatar" width={28} height={28} />
              ) : (
                <span className="mz-brand-fallback">{data.displayName.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="truncate">{data.siteName}</span>
            </Link>
            {articleTitle ? (
              <button
                type="button"
                className="mz-brand-title"
                style={{ width: titleWidth || undefined }}
                title={articleTitle}
                inert={!titleDocked || undefined}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                {articleTitle}
              </button>
            ) : null}
          </div>

          <nav className="mz-nav-links" aria-label="博客导航" ref={navLinksRef}>
            {navItems.map((it) => (
              <Link key={it.href} href={it.href} aria-current={active(it.href, it.end) ? 'page' : undefined} className={cn('mz-nav-link', active(it.href, it.end) && 'is-active')}>
                <it.icon className="size-3.5 opacity-70" />
                {it.label}
              </Link>
            ))}
            {data.pages.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className={cn('mz-nav-link', active(`/p/${p.slug}`) && 'is-active')}>
                {p.label}
              </Link>
            ))}
          </nav>

          <div className="mz-nav-actions" ref={navActionsRef}>
            {articleToc.length > 0 && (
              <button type="button" className={cn('mz-icon-btn mz-mobile-toc-button', tocOpen && 'is-active')}
                ref={tocButtonRef} aria-label="文章目录" title="文章目录" aria-expanded={tocOpen} aria-controls="mobile-article-toc"
                onClick={() => { setTocOpen((open) => !open); setMenuOpen(false) }}>
                <ListTree className="size-4" aria-hidden="true" />
              </button>
            )}
            <ThemeToggle variant="cycle" className="mz-icon-btn" />
            {data.isOwner ? (
              <Link href="/manage" className="mz-icon-btn" title="管理" aria-label="管理">
                <Settings className="size-4" />
              </Link>
            ) : (
              <Link href={loginHref} className="mz-icon-btn" title="登录" aria-label="登录">
                <LogIn className="size-4" />
              </Link>
            )}
            <button
              type="button"
              className="mz-icon-btn mz-menu-btn"
              aria-label="菜单"
              aria-expanded={menuOpen}
              ref={menuButtonRef}
              onClick={() => { setMenuOpen((v) => !v); setTocOpen(false) }}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {articleToc.length > 0 && (
        <div className="mz-mobile-toc-dropdown" data-open={tocOpen} id="mobile-article-toc"
          inert={!tocOpen || undefined} aria-hidden={!tocOpen}>
          <div className="mz-mobile-toc-clip">
            <nav className="mz-mobile-toc-panel" aria-label="移动端文章目录">
              <div className="mz-mobile-toc-heading">文章目录<ChevronDown className="size-4" aria-hidden="true" /></div>
              <ul>
                {articleToc.map((item) => (
                  <li key={item.id}>
                    <a href={item.id === 'article-top' ? '#' : `#${item.id}`}
                      style={{ paddingLeft: `${0.75 + Math.max(0, item.level - tocBaseLevel) * 0.85}rem` }}
                      onClick={(event) => {
                        event.preventDefault()
                        setTocOpen(false)
                        tocButtonRef.current?.focus()
                        const heading = document.getElementById(item.id)
                        const offset = (navInnerRef.current?.getBoundingClientRect().bottom || 68) + 16
                        const top = item.id === 'article-top' ? 0 : heading ? window.scrollY + heading.getBoundingClientRect().top - offset : null
                        if (top == null) return
                        window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
                        history.replaceState(history.state, '', item.id === 'article-top' ? location.pathname + location.search : `#${encodeURIComponent(item.id)}`)
                      }}>
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      <div className={cn('mz-mobile-menu', menuOpen && 'is-open')}>
        <div className="mz-mobile-panel">
          {navItems.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setMenuOpen(false)}
              className={cn('mz-nav-link', active(it.href, it.end) && 'is-active')}
            >
              <it.icon className="size-3.5 opacity-70" />
              {it.label}
            </Link>
          ))}
          {data.pages.map((p) => (
            <Link key={p.slug} href={`/p/${p.slug}`} className="mz-nav-link" onClick={() => setMenuOpen(false)}>
              {p.label}
            </Link>
          ))}
          {data.isOwner ? null : (
            <Link href={loginHref} className="mz-nav-link" onClick={() => setMenuOpen(false)}>
              <LogIn className="size-3.5 opacity-70" />
              登录
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
