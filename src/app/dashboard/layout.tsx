import { redirect } from 'next/navigation'
import { getViewer } from '@/server/session'
import { isInitialized } from '@/server/tenant'
import { SiteHeader } from '@/components/site-header'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isInitialized()) redirect('/setup')
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
