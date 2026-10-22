import { BlogEditor } from '@/components/dashboard/blog-editor'
import { siteOwner } from '@/server/tenant'

export const dynamic = 'force-dynamic'

export default function NewArticlePage() {
  return <BlogEditor username={siteOwner().username} />
}
