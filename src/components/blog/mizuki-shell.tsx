'use client'

import Link from 'next/link'
import { MotionSurface } from '@/components/motion/motion-surface'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowUp,
  Calendar,
  Eye,
  FolderOpen,
  Home,
  Info,
  Menu,
  LogIn,
  Settings,
  Users,
} from 'lucide-react'
import { formatDateCn } from '@/lib/blog-present'
import { cn } from '@/lib/utils'
import { ThemeInit, ThemeToggle } from './theme-toggle'
import { BlogSiteFooter } from './site-footer'
import { BlogChrome } from './blog-chrome'
import { useIsDark } from './use-is-dark'
import { useBlogRouteScroll } from './use-blog-route-scroll'
import type { BlogShellData } from './shell-types'

/** Characters kept after the ellipsis in sidebar titles. */
const RECENT_TAIL = 6

export function MizukiShell({
  data,
  scheme,
  children,
}: {
  data: BlogShellData
  scheme: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  useBlogRouteScroll()
  const base = ''
  const dark = useIsDark()

  const [menuOpen, setMenuOpen] = useState(false)
  const [compactNav, setCompactNav] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const navInnerRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const navLinksRef = useRef<HTMLElement>(null)
  const navActionsRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!compactNav) setMenuOpen(false)
  }, [compactNav])

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
      setCompactNav(required > available)
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
    const onScroll = () => setShowTop(window.scrollY > 360)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navItems = [
    { href: '/', label: '首页', icon: Home, end: true },
    { href: `${base}/categories`, label: '分类', icon: FolderOpen },
    { href: `${base}/archives`, label: '归档', icon: Archive },
    ...(data.staticSites.length ? [{ href: `${base}/static`, label: '静态页', icon: FolderOpen }] : []),
    ...(data.showFriends ? [{ href: `${base}/friends`, label: '友链', icon: Users }] : []),
    { href: `${base}/about`, label: '关于', icon: Info },
  ]

  function active(href: string, end?: boolean) {
    return end ? pathname === href : pathname.startsWith(href)
  }

  return (
    <BlogChrome>
      {({ panel, articleTitle }) => (
    <div data-blog-theme="mizuki" className={cn('mz-shell', dark && 'dark', compactNav && 'is-compact')}>
      <ThemeInit scheme={scheme} />
      <div className="mz-top-row">
      <header className="mz-navbar" aria-label="导航">
        <div className="mz-nav-inner" ref={navInnerRef}>
          <Link href="/" className="mz-brand" ref={brandRef}>
            {data.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar} alt="" className="mz-brand-avatar" width={28} height={28} />
            ) : (
              <span className="mz-brand-fallback">{data.displayName.slice(0, 1).toUpperCase()}</span>
            )}
            <span className="truncate">{data.siteName}</span>
          </Link>

          <nav className="mz-nav-links" aria-label="博客导航" ref={navLinksRef}>
            {navItems.map((it) => (
              <Link key={it.href} href={it.href} className={cn('mz-nav-link', active(it.href, it.end) && 'is-active')}>
                <it.icon className="size-3.5 opacity-70" />
                {it.label}
              </Link>
            ))}
            {data.pages.map((p) => (
              <Link key={p.slug} href={`${base}/p/${p.slug}`} className="mz-nav-link">
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
              <Link href={`/login?next=${encodeURIComponent(pathname || '/')}`} className="mz-icon-btn" title="登录" aria-label="登录">
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
              <Link
                key={p.slug}
                href={`${base}/p/${p.slug}`}
                className="mz-nav-link"
                onClick={() => setMenuOpen(false)}
              >
                {p.label}
              </Link>
            ))}
            {data.isOwner ? null : (
              <Link href={`/login?next=${encodeURIComponent(pathname || '/')}`} className="mz-nav-link" onClick={() => setMenuOpen(false)}>
                <LogIn className="size-3.5 opacity-70" />
                登录
              </Link>
            )}
          </div>
        </div>

      </div>

      <MotionSurface mode="blog" />
      <div className="mz-main-wrap">
        <div
          className={cn(
            'mz-grid',
            // An article without an outline has nothing left for the sidebar.
            (articleTitle == null || panel) && 'has-sidebar',
            articleTitle != null && 'is-article',
          )}
        >
          <main className="mz-content" aria-label="正文">
            {children}
          </main>

          {(articleTitle == null || panel) && (
          <aside className="mz-sidebar" aria-label="侧栏">
            {/* Article pages keep only the outline (passed in as `panel`). */}
            {articleTitle == null && data.recentPosts.length > 0 && (
              <div className="mz-widget">
                <h2 className="mz-widget-title">最近更新</h2>
                <ul className="mz-panel-list">
                  {data.recentPosts.slice(0, 5).map((a) => {
                    // Middle ellipsis: the head shrinks, the tail stays visible.
                    const chars = Array.from(a.title)
                    const head = chars.slice(0, -RECENT_TAIL).join('')
                    const tail = chars.slice(-RECENT_TAIL).join('')
                    return (
                      <li key={a.id}>
                        <Link href={`${base}/${a.slug}`} className="mz-recent-item" title={a.title}>
                          <span className="mz-recent-title">
                            <span className="mz-recent-head">{head}</span>
                            <span className="mz-recent-tail">{tail}</span>
                          </span>
                          <span className="mz-recent-meta">
                            <span>
                              <Calendar />
                              {formatDateCn(a.publishedAt)}
                            </span>
                            <span>
                              <Eye />
                              {a.viewCount}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {articleTitle == null && data.categories.length > 0 && (
              <div className="mz-widget">
                <h2 className="mz-widget-title">分类</h2>
                <div className="flex flex-wrap gap-1.5">
                  {data.categories.map((c) => (
                    <Link key={c.id} href={`/?categoryId=${c.id}`} className="mz-tag">
                      {c.name}
                      {c.articleCount != null ? ` · ${c.articleCount}` : ''}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {panel}
          </aside>
          )}
        </div>
      </div>

      <BlogSiteFooter themeId="mizuki" displayName={data.displayName} username={data.username} icpNumber={data.icpNumber} />

      <button
        type="button"
        className={cn('mz-back-top', showTop && 'is-visible')}
        aria-label="回到顶部"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
      )}
    </BlogChrome>
  )
}
