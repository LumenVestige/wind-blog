import { ManageArticles } from '@/components/dashboard/manage-articles'
import { siteOwner } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default function ManageArticlesPage() {
  return <ManageArticles username={siteOwner().username} />
}
