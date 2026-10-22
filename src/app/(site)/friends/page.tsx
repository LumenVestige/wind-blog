export const metadata = { title: '友链' }
import { redirect } from 'next/navigation'
import { siteOwner } from '@/server/tenant'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { Markdown } from '@/components/blog/markdown'

export const dynamic = 'force-dynamic'

export default async function FriendsPage() {
  const author = siteOwner()
  const username = author.username
  const cfg = siteConfigData(ensureSiteConfig(author.id))
  const md = cfg.friendsMd.trim()
  if (!md) redirect(`/`)

  if (cfg.themeId === 'chirpy') {
    return (
      <article className="chirpy-article px-1 pt-6">
        <header>
          <h1>友链</h1>
        </header>
        <div className="chirpy-prose">
          <Markdown source={md} className="" />
        </div>
      </article>
    )
  }

  if (cfg.themeId === 'mizuki') {
    return (
      <article className="mz-article">
        <h1>友链</h1>
        <div className="mz-prose">
          <Markdown source={md} className="" />
        </div>
      </article>
    )
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">友链</h1>
      <Markdown source={md} />
    </div>
  )
}
