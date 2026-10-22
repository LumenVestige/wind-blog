import { redirect } from 'next/navigation'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { listPagesPublic } from '@/server/blog/pages'
import { listStaticPublic } from '@/server/blog/static-sites'
import { listCategoriesPublic } from '@/server/blog/categories'
import { listByUsername } from '@/server/blog/articles'
import { expandUrl } from '@/server/images'
import { getViewer } from '@/server/session'
import { isInitialized, siteOwner, siteName } from '@/server/tenant'
import { getSetting } from '@/lib/settings'
import { MizukiShell } from '@/components/blog/mizuki-shell'
import { ChirpyShell } from '@/components/blog/chirpy-shell'
import { SimpleShell } from '@/components/blog/simple-shell'
import type { BlogShellData } from '@/components/blog/shell-types'

export const dynamic = 'force-dynamic'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  if (!isInitialized()) redirect('/setup')
  const author = siteOwner()
  const username = author.username
  const cfg = siteConfigData(ensureSiteConfig(author.id))
  const viewer = await getViewer()

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
  const recent = listByUsername(username, { page: 1, pageSize: 3 })
  const recentPosts = recent.list.map((a) => ({ id: a.id, slug: a.slug, title: a.title }))

  const data: BlogShellData = {
    siteName: siteName(),
    username: author.username,
    displayName: author.name || author.username,
    avatar: expandUrl(author.avatar),
    subtitle: cfg.subtitle,
    socialLinks: cfg.socialLinks,
    showFriends: !!cfg.friendsMd.trim(),
    isOwner: !!viewer && (viewer.id === author.id || viewer.isAdmin),
    icpNumber: getSetting('icp_number', ''),
    recentPosts,
    categories,
    pages,
    staticSites,
  }

  if (cfg.themeId === 'chirpy') {
    return (
      <ChirpyShell data={data} scheme={cfg.colorScheme}>
        {children}
      </ChirpyShell>
    )
  }
  if (cfg.themeId === 'simple') {
    return (
      <SimpleShell data={data} scheme={cfg.colorScheme}>
        {children}
      </SimpleShell>
    )
  }
  return (
    <MizukiShell data={data} scheme={cfg.colorScheme}>
      {children}
    </MizukiShell>
  )
}
