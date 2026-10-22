import { redirect } from 'next/navigation'
import { getViewer } from '@/server/session'

export const dynamic = 'force-dynamic'

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  const sp = await searchParams
  const id = typeof sp.id === 'string' ? sp.id : ''
  redirect(id ? `/manage/edit/${id}` : `/manage/new`)
}
