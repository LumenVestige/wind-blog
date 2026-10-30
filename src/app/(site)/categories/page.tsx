import { siteOwner } from '@/server/tenant'
import { listCategoriesPublic } from '@/server/blog/categories'
import { BlogPageView } from '@/components/blog/blog-page-view'

export const metadata = { title: '分类' }
export const dynamic = 'force-dynamic'

export default function CategoriesPage() {
  return <BlogPageView data={{ kind: 'categories', list: listCategoriesPublic(siteOwner().username) }} />
}
