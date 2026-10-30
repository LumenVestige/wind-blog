import { siteOwner } from '@/server/tenant'
import { listStaticPublic } from '@/server/blog/static-sites'
import { BlogPageView } from '@/components/blog/blog-page-view'

export const metadata = { title: '静态页' }
export const dynamic = 'force-dynamic'

export default function StaticSitesPage() {
  const list = listStaticPublic(siteOwner().username).map(({ id, title, publicPath, updatedAt }) => ({ id, title, publicPath, updatedAt }))
  return <BlogPageView data={{ kind: 'static', list }} />
}
