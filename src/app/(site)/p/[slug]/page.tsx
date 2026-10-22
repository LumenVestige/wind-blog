import { getViewer } from '@/server/session'
import { get } from '@/db'
import { publicBase } from '@/server/metadata'
import { notFound } from 'next/navigation'
import { siteOwner } from '@/server/tenant'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { getPagePublic } from '@/server/blog/pages'
import { Markdown } from '@/components/blog/markdown'

export const dynamic = 'force-dynamic'

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const author = siteOwner()
  const username = author.username
  const themeId = siteConfigData(ensureSiteConfig(author.id)).themeId
  let page
  try {
    page = getPagePublic(username, slug)
  } catch {
    const viewer = await getViewer()
    const draft = viewer?.id === author.id || viewer?.isAdmin ? get<{ title: string; content_md: string; slug: string }>('SELECT title, content_md, slug FROM blog_pages WHERE user_id = ? AND slug = ?', author.id, slug) : undefined
    if (!draft) notFound()
    page = { title: draft.title + '（草稿预览）', contentMd: draft.content_md }
  }

  if (themeId === 'chirpy') {
    return (
      <article className="chirpy-article px-1 pt-6">
        <header>
          <h1>{page.title}</h1>
        </header>
        <div className="chirpy-prose">
          <Markdown source={page.contentMd} className="" />
        </div>
      </article>
    )
  }
  if (themeId === 'mizuki') {
    return (
      <article className="mz-article">
        <h1>{page.title}</h1>
        <div className="mz-prose">
          <Markdown source={page.contentMd} className="" />
        </div>
      </article>
    )
  }
  return (
    <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">{page.title}</h1>
      <Markdown source={page.contentMd} />
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try { const page = getPagePublic(siteOwner().username, slug); return { title: page.title, alternates: { canonical: new URL(`/p/${encodeURIComponent(slug)}`, await publicBase()).toString() } } }
  catch { return { title: '页面预览', robots: { index: false, follow: false } } }
}
