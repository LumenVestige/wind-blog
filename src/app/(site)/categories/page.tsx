export const metadata = { title: '分类' }
import Link from '@/components/blog/blog-navigation'
import { FolderOpen } from 'lucide-react'
import { siteOwner } from '@/server/tenant'
import { listCategoriesPublic } from '@/server/blog/categories'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const author = siteOwner()
  const username = author.username
  const themeId = siteConfigData(ensureSiteConfig(author.id)).themeId
  const list = listCategoriesPublic(username)

  if (themeId === 'mizuki') {
    return (
      <div>
        <h1 className="mz-page-title">分类</h1>
        {list.length === 0 ? (
          <div className="mz-empty">还没有分类</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((c) => (
              <Link key={c.id} href={`/?categoryId=${c.id}`} className="mz-cat-card">
                <span className="inline-flex items-center gap-2">
                  <FolderOpen className="size-4 opacity-70" />
                  {c.name}
                </span>
                <span>{c.articleCount ?? 0} 篇</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (themeId === 'chirpy') {
    return (
      <div className="px-1 pt-6">
        <h1 className="mb-6 text-2xl font-bold text-[var(--heading-color)]">分类</h1>
        {list.length === 0 ? (
          <div className="chirpy-empty">还没有分类</div>
        ) : (
          <div className="space-y-3">
            {list.map((c) => (
              <Link
                key={c.id}
                href={`/?categoryId=${c.id}`}
                className="chirpy-cat-card block transition hover:opacity-90"
              >
                <div className="chirpy-cat-header">
                  <FolderOpen className="size-4 opacity-70" />
                  {c.name}
                  <span>{c.articleCount ?? 0} 篇</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">分类</h1>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          还没有分类
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/?categoryId=${c.id}`}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 hover:border-primary/40"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-muted-foreground">{c.articleCount ?? 0} 篇</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
