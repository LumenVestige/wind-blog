import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ApiError } from '@/lib/api'
import { getViewer } from '@/server/session'
import { publicBase } from '@/server/metadata'
import { siteOwner } from '@/server/tenant'
import { getPagePublic } from '@/server/blog/pages'
import { customPageData } from '@/server/blog/page-data'
import { BlogPageView } from '@/components/blog/blog-page-view'

export const dynamic = 'force-dynamic'

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const data = customPageData(slug, { viewer: await getViewer(), req: new Request('http://local', { headers: { cookie: (await cookies()).toString() } }) })
    return <BlogPageView data={data} />
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try { const page = getPagePublic(siteOwner().username, slug); return { title: page.title, alternates: { canonical: new URL(`/p/${encodeURIComponent(slug)}`, await publicBase()).toString() } } }
  catch { return { title: '页面预览', robots: { index: false, follow: false } } }
}
