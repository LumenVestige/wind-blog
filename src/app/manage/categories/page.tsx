import { ManageCategories } from '@/components/dashboard/manage-categories'
import { siteOwner } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default function ManageCategoriesPage() {
  return <ManageCategories username={siteOwner().username} />
}
