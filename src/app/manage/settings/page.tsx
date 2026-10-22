import { getViewer } from '@/server/session'
import { findUserById } from '@/server/users'
import { BlogSettings } from '@/components/dashboard/blog-settings'

export const dynamic = 'force-dynamic'

export default async function ManageSettingsPage() {
  const viewer = (await getViewer())!
  const user = findUserById(viewer.id)!
  return <BlogSettings username={user.username} name={user.name} />
}
