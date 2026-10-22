import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getViewer } from '@/server/session'
import { isInitialized, siteOwner } from '@/server/tenant'
import { BlogAdminShell } from '@/components/dashboard/blog-admin-shell'
import '@/styles/admin.css'

export const dynamic = 'force-dynamic'

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  if (!isInitialized()) redirect('/setup')
  const viewer = await getViewer()
  if (!viewer) redirect(`/login?next=${encodeURIComponent((await headers()).get('x-wind-path') || '/manage')}`)
  const author = siteOwner()
  if (viewer.id !== author.id && !viewer.isAdmin) redirect('/')
  return (
    <BlogAdminShell username={author.username} displayName={author.name || author.username}>
      {children}
    </BlogAdminShell>
  )
}
