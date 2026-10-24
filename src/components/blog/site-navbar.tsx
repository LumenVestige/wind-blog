'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Archive, FolderOpen, Home, Info, LogIn, Menu, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'
import type { BlogShellData } from './shell-types'

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
}: {
  data: SiteNavbarData
  /** Set on article pages; the brand swaps to it once the page title scrolls under the bar. */
  articleTitle?: string | null
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
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
  }, [pathname])

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
    return end ? pathname === href : pathname.startsWith(href)
  }

  const loginHref = `/login?next=${encodeURIComponent(pathname || '/')}`

  return (
    <div className={cn('mz-top-row', compact && 'is-compact')}>
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
              <Link key={it.href} href={it.href} className={cn('mz-nav-link', active(it.href, it.end) && 'is-active')}>
                <it.icon className="size-3.5 opacity-70" />
                {it.label}
              </Link>
            ))}
            {data.pages.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="mz-nav-link">
                {p.label}
              </Link>
            ))}
          </nav>

          <div className="mz-nav-actions" ref={navActionsRef}>
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
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Menu className="size-4" />
            </button>
          </div>
        </div>
      </header>

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
