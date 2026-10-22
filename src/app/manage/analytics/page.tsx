import { ManageAnalytics } from '@/components/dashboard/manage-analytics'
import { siteOwner } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  return <ManageAnalytics username={siteOwner().username} />
}
