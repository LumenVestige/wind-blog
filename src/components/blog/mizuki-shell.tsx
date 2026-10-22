'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowUp,
  FolderOpen,
  Home,
  Info,
  Menu,
  Search,
  LogIn,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ThemeInit, ThemeToggle } from './theme-toggle'
import { SocialIcon, socialAriaLabel } from './social-icon'
import { BlogSiteFooter } from './site-footer'
import { BlogChrome } from './blog-chrome'
import { useIsDark } from './use-is-dark'
import { useBlogRouteScroll } from './use-blog-route-scroll'
import type { BlogShellData } from './shell-types'

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
  const router = useRouter()
  const base = ''
  const dark = useIsDark()

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ id: number; slug: string; title: string; summary?: string }[]>([])
  const [showTop, setShowTop] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 360)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const kw = q.trim()
    if (timer.current) clearTimeout(timer.current)
    if (!kw) {
      setHits([])
      return
    }
    timer.current = setTimeout(() => {
      api
        .get<{ list: typeof hits }>('/api/user/blog/by-username', {
          username: data.username,
          keyword: kw,
          page: 1,
          pageSize: 10,
        })
        .then((r) => setHits(r.list || []))
        .catch(() => setHits([]))
    }, 280)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q, searchOpen, data.username])

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

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const kw = q.trim()
    router.push(kw ? `/?q=${encodeURIComponent(kw)}` : '/')
    setSearchOpen(false)
  }

  return (
    <BlogChrome>
      {({ panel }) => (
    <div data-blog-theme="mizuki" className={cn('mz-shell', dark && 'dark')}>
      <ThemeInit scheme={scheme} />
      <div className="mz-top-row">
      <header className="mz-navbar" aria-label="导航">
        <div className="mz-nav-inner">
          <Link href="/" className="mz-brand">
            {data.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar} alt="" className="mz-brand-avatar" width={28} height={28} />
            ) : (
              <span className="mz-brand-fallback">{data.displayName.slice(0, 1).toUpperCase()}</span>
            )}
            <span className="truncate">{data.siteName}</span>
          </Link>

          <nav className="mz-nav-links" aria-label="博客导航">
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

          <div className="mz-nav-actions">
            <button
              type="button"
              className="mz-icon-btn"
              aria-label="搜索"
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
            </button>
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
              className="mz-icon-btn md:hidden"
              aria-label="菜单"
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

        {searchOpen && (
          <div className="relative z-60">
          <form className="mz-search-panel" onSubmit={submitSearch}>
            <input
              ref={inputRef}
              className="mz-search-input"
              type="search"
              placeholder="搜索文章标题…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="搜索文章"
            />
            <div className="mz-search-hits">
              {q.trim() && hits.length === 0 ? (
                <p className="px-2 py-3 text-sm text-[var(--mz-text-50)]">没有匹配的文章</p>
              ) : (
                hits.map((a) => (
                  <Link
                    key={a.id}
                    href={`${base}/${a.slug}`}
                    className="mz-search-hit"
                    onClick={() => setSearchOpen(false)}
                  >
                    {a.title}
                  </Link>
                ))
              )}
            </div>
          </form>
          </div>
        )}
      </div>

      <div className="mz-main-wrap">
        <div className="mz-grid has-sidebar">
          <main className="mz-content" aria-label="正文">
            {children}
          </main>

          <aside className="mz-sidebar" aria-label="侧栏">
            <div className="mz-widget mz-profile-card">
              {data.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.avatar} alt="" className="mz-profile-avatar" width={88} height={88} />
              ) : (
                <div className="mz-profile-avatar-fallback">
                  {data.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="mz-profile-name">{data.displayName}</p>
              <p className="mz-profile-bio">{data.subtitle || `@${data.username}`}</p>
              {data.socialLinks.length > 0 && (
                <div className="mz-social-row">
                  {data.socialLinks.map((link, i) => (
                    <a
                      key={`${link.type}-${i}`}
                      href={link.url}
                      className="mz-social-btn"
                      aria-label={socialAriaLabel(link)}
                      title={socialAriaLabel(link)}
                      target={link.type === 'email' ? undefined : '_blank'}
                      rel={link.type === 'email' ? undefined : 'noopener noreferrer'}
                    >
                      <SocialIcon type={link.type} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {data.recentPosts.length > 0 && (
              <div className="mz-widget">
                <h2 className="mz-widget-title">最近更新</h2>
                <ul className="mz-panel-list">
                  {data.recentPosts.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <Link href={`${base}/${a.slug}`}>{a.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.categories.length > 0 && (
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
