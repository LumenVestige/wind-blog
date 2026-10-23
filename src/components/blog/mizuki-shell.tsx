'use client'

import Link from 'next/link'
import { MotionSurface } from '@/components/motion/motion-surface'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Archive,
  ArrowUp,
  FolderOpen,
  Home,
  Info,
  LogIn,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeInit, ThemeToggle } from './theme-toggle'
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
  const base = ''
  const dark = useIsDark()

  const [showTop, setShowTop] = useState(false)

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
          </div>
        </div>
      </header>

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
                  {data.recentPosts.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      <Link href={`${base}/${a.slug}`}>{a.title}</Link>
                    </li>
                  ))}
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
