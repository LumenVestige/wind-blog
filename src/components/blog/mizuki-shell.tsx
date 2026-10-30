'use client'

import Link from '@/components/blog/blog-navigation'
import { BlogNavigationProvider, BlogPageContent } from './blog-navigation'
import { ArticleResourceWarmup } from './article-resource-warmup'
import { MotionSurface } from '@/components/motion/motion-surface'
import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ArrowUp, Calendar, Eye } from 'lucide-react'
import { formatDateCn } from '@/lib/blog-present'
import { cn } from '@/lib/utils'
import { isArticlePathname } from '@/lib/blog-route'
import { ThemeInit } from './theme-toggle'
import { SiteNavbar } from './site-navbar'
import { BlogSiteFooter } from './site-footer'
import { CategoryFilterList, CategoryLinks, TagFilterList, TagLinks } from './category-filter-list'
import { BlogChrome } from './blog-chrome'
import { useIsDark } from './use-is-dark'
import { useBlogRouteScroll } from './use-blog-route-scroll'
import type { BlogShellData } from './shell-types'

/** Characters kept after the ellipsis in sidebar titles. */
const RECENT_TAIL = 6

/** Pages that render without the right-hand sidebar. */
const SIDEBARLESS_PATHS = new Set(['/about'])

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
  const articlePage = isArticlePathname(pathname)
  useBlogRouteScroll()
  const base = ''
  const dark = useIsDark()

  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 360)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <BlogNavigationProvider>
    <ArticleResourceWarmup />
    <BlogChrome>
      {({ panel, articleTitle, articleToc }) => {
        // Articles keep only their outline; archives place their filters on the left.
        const showSidebar =
          !SIDEBARLESS_PATHS.has(pathname) && (!articlePage || articleTitle == null || !!panel)
        return (
    <div data-blog-theme="mizuki" className={cn('mz-shell', dark && 'dark')}>
      <ThemeInit scheme={scheme} />
      <SiteNavbar data={data} articleTitle={articleTitle || null} articleToc={articleToc} />

      <MotionSurface mode="blog" />
      <div className="mz-main-wrap">
        <div
          className={cn(
            'mz-grid',
            showSidebar && 'has-sidebar',
            articlePage && 'is-article',
            pathname === '/archives' && 'is-archives',
          )}
        >
          <main className="mz-content" aria-label="正文">
            <BlogPageContent>{children}</BlogPageContent>
          </main>

          {showSidebar && (
          <aside className="mz-sidebar" aria-label="侧栏">
            {/* Article pages keep only the outline (passed in as `panel`). */}
            {pathname !== '/archives' && !articlePage && data.recentPosts.length > 0 && (
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
                        <Link href={`${base}/${a.slug}`} articleSlug={a.slug} className="mz-recent-item" title={a.title}>
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

            {!articlePage && data.categories.length > 0 && (
              <div className="mz-widget">
                <h2 className="mz-widget-title">分类</h2>
                <Suspense fallback={<CategoryLinks categories={data.categories} />}>
                  <CategoryFilterList categories={data.categories} />
                </Suspense>
              </div>
            )}

            {!articlePage && data.tags.length > 0 && (
              <div className="mz-widget">
                <h2 className="mz-widget-title">标签</h2>
                <Suspense fallback={<TagLinks tags={data.tags} />}>
                  <TagFilterList tags={data.tags} />
                </Suspense>
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
        )
      }}
    </BlogChrome>
    </BlogNavigationProvider>
  )
}
