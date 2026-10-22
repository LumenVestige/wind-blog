import { notFound } from 'next/navigation'
import { ManagePageEditor } from '@/components/dashboard/manage-page-editor'
import { listPagesMine } from '@/server/blog/pages'
import { requireManageViewer } from '@/server/manage-access'
import { siteOwner } from '@/server/tenant'
export const dynamic = 'force-dynamic'
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireManageViewer(`/manage/pages/${id}/edit`)
  const owner = siteOwner()
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound()
  const page = listPagesMine(owner.id).find(item => item.id === Number(id))
  if (!page) notFound()
  return <ManagePageEditor initial={page} username={owner.username} />
}
