import { ManagePageEditor } from '@/components/dashboard/manage-page-editor'
import { siteOwner } from '@/server/tenant'
export const dynamic = 'force-dynamic'
export default function NewPage() { return <ManagePageEditor username={siteOwner().username} /> }
