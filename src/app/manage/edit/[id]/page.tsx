import { notFound } from 'next/navigation'
import { BlogEditor } from '@/components/dashboard/blog-editor'
import { siteOwner } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound()
  return <BlogEditor key={id} username={siteOwner().username} articleId={Number(id)} />
}
