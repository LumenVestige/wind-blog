import { redirect } from 'next/navigation'
import { getViewer } from '@/server/session'

export const dynamic = 'force-dynamic'

export default async function SettingsRedirectPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  redirect(`/manage/settings`)
}
