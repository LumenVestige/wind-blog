export const metadata = { title: '文章归档' }
import Link from '@/components/blog/blog-navigation'
import { siteOwner } from '@/server/tenant'
import { listByUsername, type ArticleInfo } from '@/server/blog/articles'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { listCategoriesPublic } from '@/server/blog/categories'

export const dynamic = 'force-dynamic'

function loadAll(username: string, filters: { categoryId?: number; tags?: string[] } = {}): ArticleInfo[] {
  const pageSize = 100
  const first = listByUsername(username, { ...filters, page: 1, pageSize })
  const list = [...first.list]
  const pages = Math.ceil(first.total / pageSize)
  for (let page = 2; page <= pages; page += 1) {
    list.push(...listByUsername(username, { ...filters, page, pageSize }).list)
  }
  return list
}

export default async function ArchivesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const author = siteOwner()
  const username = author.username
  const themeId = siteConfigData(ensureSiteConfig(author.id)).themeId
  const params = await searchParams
  const category = listCategoriesPublic(username).find((c) => String(c.id) === params.categoryId || c.name === params.category)
  const tags = ([] as string[]).concat(params.tag || []).filter(Boolean)
  const unknownCategory = !!(params.categoryId || params.category) && !category
  const list = unknownCategory ? [] : loadAll(username, { categoryId: category?.id, tags })

  const map = new Map<number, { article: ArticleInfo; month: number; day: number }[]>()
  for (const a of list) {
    const d = new Date((a.publishedAt || a.createdAt) * 1000)
    const year = d.getFullYear()
    if (!map.has(year)) map.set(year, [])
    map.get(year)!.push({ article: a, month: d.getMonth() + 1, day: d.getDate() })
  }
  const groups = [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }))

  if (themeId === 'mizuki') {
    return (
      <div className="mz-archive-panel" id="archives">
        <h1 className="sr-only">{category ? `${category.name} · ` : ''}{tags.length ? `${tags.join('、')} · ` : ''}文章归档</h1>
        {groups.length === 0 ? (
          <div className="mz-archive-empty">{category || tags.length || unknownCategory ? '这个分类或标签下还没有文章' : '还没有文章'}</div>
        ) : (
          groups.map((g) => (
            <section key={g.year} aria-label={`${g.year} 年`}>
              <div className="mz-archive-year">
                <h2>{g.year}</h2><span className="mz-archive-year-marker" aria-hidden="true" />
                <span className="mz-archive-count">{g.items.length} 篇文章</span>
              </div>
              <ul className="mz-archive-list">
                {g.items.map(({ article: a, month, day }) => (
                  <li key={a.id}>
                    <Link href={`/${a.slug}`} articleSlug={a.slug} className="mz-archive-row" aria-label={a.title} title={a.title}>
                      <time className="date" dateTime={new Date((a.publishedAt || a.createdAt) * 1000).toISOString()}>{String(month).padStart(2, '0')}-{String(day).padStart(2, '0')}</time>
                      <span className="mz-archive-dot" aria-hidden="true" />
                      <span className="mz-archive-title">{a.title}</span>
                      <span className="mz-archive-tags" aria-hidden="true">{a.tags.map((tag) => `#${tag}`).join(' ')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    )
  }

  if (themeId === 'chirpy') {
    return (
      <div className="chirpy-archives" id="archives">
        <h1 className="mb-4 text-2xl font-bold text-[var(--heading-color)]">归档</h1>
        {groups.length === 0 ? (
          <div className="chirpy-empty">还没有文章</div>
        ) : (
          groups.map((g) => (
            <div key={g.year}>
              <div className="year">{g.year}</div>
              <ul>
                {g.items.map(({ article: a, month, day }) => (
                  <li key={a.id}>
                    <span className="date">
                      {String(month).padStart(2, '0')}/{String(day).padStart(2, '0')}
                    </span>
                    <Link href={`/${a.slug}`}>{a.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">归档</h1>
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          还没有文章
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.year} className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 font-semibold">{g.year}</h2>
            <ul className="space-y-1 text-sm">
              {g.items.map(({ article: a, month, day }) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-12 shrink-0 text-muted-foreground">
                    {String(month).padStart(2, '0')}/{String(day).padStart(2, '0')}
                  </span>
                  <Link href={`/${a.slug}`} className="hover:text-primary">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
