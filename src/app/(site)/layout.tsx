import { redirect } from 'next/navigation'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { listPagesPublic } from '@/server/blog/pages'
import { listStaticPublic } from '@/server/blog/static-sites'
import { listCategoriesPublic } from '@/server/blog/categories'
import { listTagsPublic } from '@/server/blog/tags'
import { listByUsername } from '@/server/blog/articles'
import { expandUrl } from '@/server/images'
import { getViewer } from '@/server/session'
import { isInitialized, siteOwner, siteName } from '@/server/tenant'
import { getSetting } from '@/lib/settings'
import { MizukiShell } from '@/components/blog/mizuki-shell'
import type { BlogShellData } from '@/components/blog/shell-types'
import { navigationArticles } from '@/server/blog/navigation'
import { BlogNavigationProvider } from '@/components/blog/blog-navigation'

export const dynamic = 'force-dynamic'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  if (!isInitialized()) redirect('/setup')
  const author = siteOwner()
  const username = author.username
  const cfg = siteConfigData(ensureSiteConfig(author.id))
  const viewer = await getViewer()
  const navigation = navigationArticles(author.id)

  const pages = listPagesPublic(username).map((p) => ({
    slug: p.slug,
    label: p.navLabel || p.title,
  }))
  const staticSites = listStaticPublic(username).map((s) => ({
    slug: s.slug,
    label: s.navLabel || s.title,
    publicPath: s.publicPath,
  }))
  const categories = listCategoriesPublic(username).map((c) => ({
    id: c.id,
    name: c.name,
    articleCount: c.articleCount,
  }))
  const recent = listByUsername(username, { page: 1, pageSize: 5 })
  const recentPosts = recent.list.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    publishedAt: a.publishedAt || a.createdAt,
    viewCount: a.viewCount,
  }))

  const data: BlogShellData = {
    siteName: siteName(),
    username: author.username,
    displayName: author.name || author.username,
    avatar: expandUrl(author.avatar),
    subtitle: cfg.subtitle,
    socialLinks: cfg.socialLinks,
    aboutArticle: navigation.about,
    friendsArticle: navigation.friends,
    isOwner: !!viewer && (viewer.id === author.id || viewer.isAdmin),
    icpNumber: getSetting('icp_number', ''),
    recentPosts,
    categories,
    tags: listTagsPublic(username, 500),
    pages,
    staticSites,
  }

  return (
    <BlogNavigationProvider><MizukiShell data={data} scheme={cfg.colorScheme}>
      {children}
    </MizukiShell></BlogNavigationProvider>
  )
}
