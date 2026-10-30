import { BlogEditor } from '@/components/dashboard/blog-editor'
import { siteOwner } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const { preset } = await searchParams
  const title = preset === 'about' ? '关于' : preset === 'friends' ? '友链' : ''
  return <BlogEditor username={siteOwner().username} initialTitle={title} initialVisibility={title ? 'unlisted' : 'public'} returnTo={title ? 'content' : 'list'} />
}
