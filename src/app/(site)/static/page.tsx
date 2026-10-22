export const metadata = { title: '静态页' }
import Link from 'next/link'
import { siteOwner } from '@/server/tenant'
import { listStaticPublic } from '@/server/blog/static-sites'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'

export const dynamic = 'force-dynamic'

export default async function StaticSitesPage() {
  const author = siteOwner()
  const themeId = siteConfigData(ensureSiteConfig(author.id)).themeId
  const sites = listStaticPublic(author.username)
  const groups = new Map<number, typeof sites>()
  for (const site of sites) {
    const year = new Date(site.updatedAt * 1000).getFullYear()
    groups.set(year, [...(groups.get(year) || []), site])
  }
  const years = [...groups.entries()].sort((a, b) => b[0] - a[0])

  const body = years.length === 0 ? (
    <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">还没有公开的静态页</div>
  ) : years.map(([year, items]) => (
    <section key={year} className="space-y-2">
      <h2 className="text-lg font-semibold">{year}</h2>
      <ol className="space-y-3 border-l pl-4">
        {items.map((site) => {
          const date = new Date(site.updatedAt * 1000)
          const label = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
          return (
            <li key={site.id} className="flex gap-3">
              <time className="w-12 shrink-0 text-sm text-muted-foreground">{label}</time>
              <Link href={site.publicPath} className="hover:text-primary">{site.title}</Link>
            </li>
          )
        })}
      </ol>
    </section>
  ))

  if (themeId === 'mizuki') return <div className="mz-article space-y-6"><h1 className="mz-page-title">静态页</h1>{body}</div>
  if (themeId === 'chirpy') return <div className="chirpy-archives space-y-6"><h1 className="mb-4 text-2xl font-bold text-[var(--heading-color)]">静态页</h1>{body}</div>
  return <div className="space-y-6"><h1 className="text-xl font-semibold">静态页</h1>{body}</div>
}
