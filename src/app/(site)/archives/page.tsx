import { archivesPageData } from '@/server/blog/page-data'
import { blogSearchParams } from '@/lib/blog-page'
import { BlogPageView } from '@/components/blog/blog-page-view'

export const metadata = { title: '文章归档' }
export const dynamic = 'force-dynamic'

export default async function ArchivesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <BlogPageView data={archivesPageData(blogSearchParams(await searchParams))} />
}
