import { ManageStaticSites } from '@/components/dashboard/manage-static-sites'
import { upyunStatus } from '@/lib/settings'
export const dynamic = 'force-dynamic'
export default function StaticSitesPage() { return <ManageStaticSites configured={upyunStatus().configured} /> }
