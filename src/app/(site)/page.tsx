import type { Metadata } from 'next'
import { siteName } from '@/server/tenant'
import { publicBase as siteBase, siteDescription } from '@/server/metadata'
import { homePageData } from '@/server/blog/page-data'
import { blogSearchParams } from '@/lib/blog-page'
import { BlogPageView } from '@/components/blog/blog-page-view'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const name = siteName()
  const description = siteDescription()
  const url = new URL('/', await siteBase()).toString()
  return {
    title: { absolute: name },
    description,
    alternates: { canonical: url },
    openGraph: { title: name, description, url, siteName: name, type: 'website', locale: 'zh_CN' },
    twitter: { card: 'summary', title: name, description },
  }
}


export default async function BlogHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <BlogPageView data={homePageData(blogSearchParams(await searchParams))} />
}
