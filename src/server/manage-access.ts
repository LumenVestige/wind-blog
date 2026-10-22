import { redirect } from 'next/navigation'
import { getViewer } from '@/server/session'
import { getOwner } from '@/server/tenant'
export async function requireManageViewer(next = '/manage') {
  const viewer = await getViewer()
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`)
  const owner = getOwner()
  if (!owner || (viewer.id !== owner.id && !viewer.isAdmin)) redirect('/')
  return viewer
}
