import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { ApiError } from '@/lib/api'
import { extractHeadings } from '@/lib/markdown'
import { siteName, siteOwner } from '@/server/tenant'
import { getViewer } from '@/server/session'
import { publicBase } from '@/server/metadata'
import { assertArticleVisible, getArticleBySlug } from '@/server/blog/articles'
import { articlePageData } from '@/server/blog/page-data'
import { ArticleReader } from '@/components/blog/article-reader'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const jar = await cookies()
  try {
    const data = articlePageData(slug, { viewer: await getViewer(), req: new Request('http://local', { headers: { cookie: jar.toString() } }) })
    return <ArticleReader key={data.reader.article.slug} {...data.reader} />
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const row = getArticleBySlug(siteOwner().username, slug)
  if (!row) return { title: '文章不存在', robots: { index: false } }
  try { assertArticleVisible(row, await getViewer()) } catch { return { title: '文章不存在', robots: { index: false } } }
  const publicArticle = row.visibility === 'public' && row.moderation_status === 'approved'
  const previewable = publicArticle || (row.visibility === 'unlisted' && row.moderation_status === 'approved')
  const name = siteName()
  const title = `${row.title}-${name}`
  const description = previewable
    ? (extractHeadings(row.content).map((heading) => heading.text).join('；') || row.summary || row.title).replace(/\s+/g, ' ').slice(0, 160)
    : '这是一篇受保护的文章'
  const url = new URL(`/${encodeURIComponent(row.slug)}`, await publicBase()).toString()
  return { title: { absolute: title }, description, alternates: { canonical: url },
    robots: { index: publicArticle, follow: publicArticle },
    openGraph: { title, description, url, siteName: name, type: 'article', locale: 'zh_CN' },
    twitter: { card: 'summary', title, description } }
}
