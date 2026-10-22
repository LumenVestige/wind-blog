'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowUp,
  FolderOpen,
  GalleryVerticalEnd,
  Home,
  Info,
  Menu,
  Search,
  LogIn,
  Settings,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ThemeInit, ThemeToggle } from './theme-toggle'
import { SocialIcon, socialAriaLabel } from './social-icon'
import { BlogSiteFooter } from './site-footer'
import dynamic from 'next/dynamic'
const MarkdownSummary = dynamic(() => import('./markdown-summary').then((module) => module.MarkdownSummary))
import { BlogChrome } from './blog-chrome'
import { useIsDark } from './use-is-dark'
import type { BlogShellData } from './shell-types'

export function ChirpyShell({
  data,
  scheme,
  children,
}: {
  data: BlogShellData
  scheme: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const base = ''
  const dark = useIsDark()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMode, setSearchMode] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ id: number; slug: string; title: string; summary?: string }[]>([])
  const [showTop, setShowTop] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSidebarOpen(false)
    setSearchMode(false)
    setSearchOpen(false)
    setHits([])
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchMode) inputRef.current?.focus()
  }, [searchMode])

  useEffect(() => {
    if (!searchMode) return
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
          q: kw,
          keyword: kw,
          page: 1,
          pageSize: 12,
        })
        .then((r) => setHits(r.list || []))
        .catch(() => setHits([]))
    }, 280)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q, searchMode, data.username])

  const navItems = [
    { href: '/', label: '首页', icon: Home, end: true },
    { href: `${base}/categories`, label: '分类', icon: FolderOpen },
    { href: `${base}/archives`, label: '归档', icon: Archive },
    ...(data.staticSites.length ? [{ href: `${base}/static`, label: '静态页', icon: GalleryVerticalEnd }] : []),
    ...(data.showFriends ? [{ href: `${base}/friends`, label: '友链', icon: Users }] : []),
    { href: `${base}/about`, label: '关于', icon: Info },
  ]

  function active(href: string, end?: boolean) {
    return end ? pathname === href : pathname.startsWith(href)
  }

  function breadcrumb(articleTitle: string | null) {
    if (articleTitle) return [{ label: '首页', href: '/' }, { label: articleTitle }]
    if (pathname === '/') return [{ label: '首页' }]
    const rest = pathname.slice(base.length).replace(/^\//, '')
    const map: Record<string, string> = {
      categories: '分类',
      archives: '归档',
      friends: '友链',
      about: '关于',
      p: '页面',
    }
    const seg = rest.split('/')[0]
    return [{ label: '首页', href: '/' }, { label: map[seg] || decodeURIComponent(seg) }]
  }

  const secondary = ['categories', 'archives', 'about', 'friends', 'p'].some(
    (seg) => pathname === `${base}/${seg}` || pathname.startsWith(`${base}/${seg}/`),
  )

  function closeSearch() {
    setSearchMode(false)
    setSearchOpen(false)
    setHits([])
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const kw = q.trim()
    router.push(kw ? `/?q=${encodeURIComponent(kw)}` : '/')
    closeSearch()
  }

  return (
    <BlogChrome>
      {({ panel, articleTitle }) => {
        const crumbs = breadcrumb(articleTitle)
        const showPanel = !secondary || !!panel
        return (
    <div
      data-blog-theme="chirpy"
      className={cn('chirpy-shell', dark && 'dark')}
      data-sidebar-open={sidebarOpen ? '1' : '0'}
      data-search-mode={searchMode ? '1' : '0'}
    >
      <ThemeInit scheme={scheme} />
      <button
        type="button"
        className="chirpy-mask"
        aria-label="关闭侧栏"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="chirpy-sidebar" aria-label="侧栏">
        <header className="chirpy-profile">
          <Link href="/" className="chirpy-avatar" onClick={closeSearch}>
            {data.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar} alt="" width={112} height={112} />
            ) : (
              <span className="flex size-full items-center justify-center text-2xl font-bold text-[var(--sidebar-muted-color)]">
                {data.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
          <Link href="/" className="chirpy-site-title" onClick={closeSearch}>
            {data.siteName}
          </Link>
          {data.subtitle ? <p className="chirpy-site-subtitle">{data.subtitle}</p> : null}
        </header>

        <nav className="w-full flex-1">
          <ul className="chirpy-nav">
            {navItems.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => {
                  setSidebarOpen(false)
                  closeSearch()
                }}
                className={cn('chirpy-nav-item block', active(it.href, it.end) && 'is-active')}
              >
                <span className="chirpy-nav-link">
                  <it.icon />
                  <span>{it.label}</span>
                </span>
              </Link>
            ))}
            {data.pages.map((p) => (
              <Link
                key={p.slug}
                href={`${base}/p/${p.slug}`}
                className="chirpy-nav-item block"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="chirpy-nav-link">
                  <span>{p.label}</span>
                </span>
              </Link>
            ))}

          </ul>
        </nav>

        <div className="chirpy-sidebar-bottom">
          <ThemeToggle variant="cycle" className="chirpy-icon-btn" />
          {data.socialLinks.length > 0 && <span className="chirpy-icon-border" aria-hidden />}
          {data.socialLinks.map((link, i) => (
            <a
              key={`${link.type}-${i}`}
              href={link.url}
              className="chirpy-icon-btn"
              aria-label={socialAriaLabel(link)}
              title={socialAriaLabel(link)}
              target={link.type === 'email' ? undefined : '_blank'}
              rel={link.type === 'email' ? undefined : 'noopener noreferrer'}
            >
              <SocialIcon type={link.type} />
            </a>
          ))}
        </div>
      </aside>

      <div className="chirpy-main-wrapper">
        <div className="chirpy-container">
          <header className="chirpy-topbar-wrapper" aria-label="顶栏">
            <div className="chirpy-topbar">
              {!searchMode && (
                <nav className="chirpy-breadcrumb" aria-label="面包屑">
                  {crumbs.map((c, i) => (
                    <span key={`${c.label}-${i}`}>
                      {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : c.label}
                    </span>
                  ))}
                </nav>
              )}
              <button
                type="button"
                className="chirpy-topbar-btn"
                aria-label="打开侧栏"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="size-5" />
              </button>
              {!searchMode && <div className="chirpy-topbar-title">{data.siteName}</div>}
              <button
                type="button"
                className="chirpy-topbar-btn"
                aria-label="搜索"
                onClick={() => {
                  setSearchMode(true)
                  setSearchOpen(true)
                }}
              >
                <Search className="size-5" />
              </button>

              <form
                className={cn('chirpy-search-wrap', (searchOpen || searchMode) && 'is-open')}
                onSubmit={submitSearch}
              >
                <div className="chirpy-search-field">
                  <Search />
                  <input
                    ref={inputRef}
                    className="chirpy-search-input"
                    type="search"
                    placeholder="搜索..."
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      if (e.target.value.trim()) {
                        setSearchMode(true)
                        setSearchOpen(true)
                      }
                    }}
                    aria-label="搜索文章"
                  />
                </div>
                <button type="button" className="chirpy-search-cancel" onClick={closeSearch}>
                  取消
                </button>
              </form>

              {!searchMode && (
                <div className="ml-auto hidden items-center gap-2 sm:flex">
                  {data.isOwner ? (
                    <Link
                      href="/manage"
                      className="inline-flex items-center gap-1 text-sm text-[var(--text-muted-color)] hover:text-[var(--link-hover)]"
                      title="管理"
                    >
                      <Settings className="size-3.5" />
                      <span className="hidden lg:inline">管理</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/login?next=${encodeURIComponent(pathname || '/')}`}
                      className="inline-flex items-center gap-1 text-sm text-[var(--text-muted-color)] hover:text-[var(--link-hover)]"
                      title="登录"
                    >
                      <LogIn className="size-3.5" />
                      <span className="hidden lg:inline">登录</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </header>

          {searchMode ? (
            <div className="chirpy-search-results px-4 pb-10 pt-4">
              {q.trim() && hits.length === 0 ? (
                <p className="chirpy-empty">搜索结果为空</p>
              ) : (
                <ul className="space-y-4">
                  {hits.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`${base}/${a.slug}`}
                        className="block rounded-[10px] p-3 transition hover:bg-[var(--sidebar-hover-bg)]"
                        onClick={closeSearch}
                      >
                        <h2 className="text-lg font-semibold text-[var(--heading-color)]">{a.title}</h2>
                        {a.summary ? (
                          <MarkdownSummary
                            content={a.summary}
                            className="mt-1 line-clamp-2 text-sm text-[var(--text-muted-color)]"
                          />
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="chirpy-content-row">
              <main className="chirpy-main" aria-label="正文">
                {children}
              </main>
              {showPanel && (
              <aside className="chirpy-panel" aria-label="侧栏信息">
                <div className="access">
                  <>
                  {data.recentPosts.length > 0 && (
                    <section>
                      <h2 className="chirpy-panel-heading">最近更新</h2>
                      <ul className="chirpy-panel-list">
                        {data.recentPosts.slice(0, 5).map((a) => (
                          <li key={a.id}>
                            <Link href={`${base}/${a.slug}`}>{a.title}</Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {data.categories.length > 0 && (
                    <section>
                      <h2 className="chirpy-panel-heading">分类</h2>
                      <div className="mt-3 mb-1 flex flex-wrap">
                        {data.categories.map((c) => (
                          <Link key={c.id} href={`/?categoryId=${c.id}`} className="chirpy-post-tag">
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}
                  {panel}
                  </>
                </div>
              </aside>
              )}
            </div>
          )}

          {!searchMode && (
            <div className="px-4">
              <BlogSiteFooter themeId="chirpy" displayName={data.displayName} username={data.username} icpNumber={data.icpNumber} />
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={cn('chirpy-back-top', showTop && 'is-visible')}
        aria-label="回到顶部"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
        )
      }}
    </BlogChrome>
  )
}
