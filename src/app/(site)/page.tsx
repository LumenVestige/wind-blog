import Link from 'next/link'
import { Calendar, ChevronRight, Eye, FolderOpen, Heart, MessageCircle } from 'lucide-react'
import { siteOwner } from '@/server/tenant'
import { listByUsername } from '@/server/blog/articles'
import { listCategoriesPublic } from '@/server/blog/categories'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { expandUrl } from '@/server/images'
import { Markdown } from '@/components/blog/markdown'
import { MarkdownSummary } from '@/components/blog/markdown-summary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { blogQuery, formatDateSlash, pageSizeFor } from '@/lib/blog-present'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function one(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : ''
}

export default async function BlogHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const author = siteOwner()
  const username = author.username
  const cfg = siteConfigData(ensureSiteConfig(author.id))
  if (!cfg.activated) {
    return <p className="text-muted-foreground">此用户还没有开通博客。</p>
  }

  const themeId = cfg.themeId
  const categoryId = Number(one(sp.categoryId)) || undefined
  const tag = one(sp.tag) || undefined
  const keyword = one(sp.q) || one(sp.keyword) || undefined
  const page = Math.max(1, Number(one(sp.page)) || 1)
  const pageSize = pageSizeFor(themeId)
  const res = listByUsername(username, {
    page,
    pageSize,
    categoryId,
    tag,
    keyword,
    pinnedFirst: true,
  })
  const categories = listCategoriesPublic(username)
  const catName = (id?: number | null) => categories.find((c) => c.id === id)?.name
  const pages = Math.max(1, Math.ceil(res.total / pageSize))
  const activeCat = categoryId ? catName(categoryId) : undefined
  const baseQuery = { q: keyword, categoryId, tag }

  const intro =
    cfg.homeIntroMd.trim() && !keyword && !categoryId && !tag ? (
      themeId === 'chirpy' ? (
        <div className="chirpy-prose mb-4 px-1 pt-4">
          <Markdown source={cfg.homeIntroMd} className="" />
        </div>
      ) : themeId === 'mizuki' ? (
        <div className="mz-prose mb-4">
          <Markdown source={cfg.homeIntroMd} className="" />
        </div>
      ) : (
        <div className="mb-4 rounded-xl border bg-card p-4 shadow-sm">
          <Markdown source={cfg.homeIntroMd} />
        </div>
      )
    ) : null

  const pager =
    pages > 1 ? (
      <div className={themeId === 'mizuki' ? 'mz-pagination' : 'chirpy-pagination'}>
        {page > 1 ? (
          <Link
            href={blogQuery(username, { ...baseQuery, page: page - 1 })}
            className={themeId === 'mizuki' ? 'mz-page-btn' : 'chirpy-page-btn'}
          >
            上一页
          </Link>
        ) : (
          <span className={cn(themeId === 'mizuki' ? 'mz-page-btn' : 'chirpy-page-btn', 'opacity-40')}>
            上一页
          </span>
        )}
        <span className={cn(themeId === 'mizuki' ? 'mz-page-btn' : 'chirpy-page-btn', 'is-active')}>
          {page}
        </span>
        <span className={themeId === 'mizuki' ? 'text-sm text-[var(--mz-text-50)]' : 'self-center text-sm text-[var(--text-muted-color)]'}>
          / {pages}
        </span>
        {page < pages ? (
          <Link
            href={blogQuery(username, { ...baseQuery, page: page + 1 })}
            className={themeId === 'mizuki' ? 'mz-page-btn' : 'chirpy-page-btn'}
          >
            下一页
          </Link>
        ) : (
          <span className={cn(themeId === 'mizuki' ? 'mz-page-btn' : 'chirpy-page-btn', 'opacity-40')}>
            下一页
          </span>
        )}
      </div>
    ) : null

  if (themeId === 'chirpy') {
    return (
      <div>
        {intro}
        {(keyword || activeCat || tag) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 px-1 text-sm text-[var(--text-muted-color)]">
            {keyword ? <span>搜索：{keyword}</span> : null}
            {activeCat ? <span>分类：{activeCat}</span> : null}
            {tag ? <span>标签：{tag}</span> : null}
            <Link href={`/`} className="chirpy-post-tag">
              清除筛选
            </Link>
          </div>
        )}
        {res.list.length === 0 ? (
          <div className="chirpy-empty">{keyword || categoryId || tag ? '没有找到匹配的文章，请调整筛选条件。' : '还没有公开文章'}</div>
        ) : (
          <div id="post-list" className="chirpy-post-list">
            {res.list.map((a) => (
              <Link key={a.id} href={`/${a.slug}`} className="chirpy-card">
                <div className="chirpy-card-body">
                  <h2 className="chirpy-card-title">{a.title}</h2>
                  {a.summary ? (
                    <div className="chirpy-card-text">
                      <MarkdownSummary content={a.summary} />
                    </div>
                  ) : null}
                  <div className="chirpy-post-meta">
                    <div className="meta-left">
                      <Calendar className="inline" />
                      <time>{formatDateSlash(a.publishedAt || a.createdAt)}</time>
                      {a.pinned ? <Badge variant="secondary">置顶</Badge> : null}
                      {catName(a.categoryId) ? (
                        <>
                          <FolderOpen className="meta-sep inline" />
                          <span className="categories">{catName(a.categoryId)}</span>
                        </>
                      ) : null}
                      {a.visibility === 'password' ? (
                        <span className="meta-sep text-xs opacity-70">密码</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {pager}
      </div>
    )
  }

  if (themeId === 'mizuki') {
    return (
      <div>
        {intro}
        {(keyword || activeCat || tag) && (
          <div className="mz-filter-bar">
            {keyword ? <span className="text-sm text-[var(--mz-text-50)]">搜索：{keyword}</span> : null}
            {activeCat ? <span className="text-sm text-[var(--mz-text-50)]">分类：{activeCat}</span> : null}
            {tag ? <span className="text-sm text-[var(--mz-text-50)]">标签：{tag}</span> : null}
            <Link href={`/`} className="mz-tag">
              清除筛选
            </Link>
          </div>
        )}
        {res.list.length === 0 ? (
          <div className="mz-empty">{keyword || categoryId || tag ? '没有找到匹配的文章，请调整筛选条件。' : '还没有公开文章'}</div>
        ) : (
          <div className="mz-post-list">
            {res.list.map((a) => (
              <Link
                key={a.id}
                href={`/${a.slug}`}
                className={cn('mz-post-card', a.coverUrl && 'has-cover')}
              >
                <div className="mz-post-body">
                  <h2 className="mz-post-title">{a.title}</h2>
                  <div className="mz-post-meta">
                    <span className="inline-flex items-center gap-1">
                      <Calendar />
                      <time>{formatDateSlash(a.publishedAt || a.createdAt)}</time>
                    </span>
                    {a.pinned ? <Badge variant="secondary">置顶</Badge> : null}
                    {catName(a.categoryId) ? (
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen />
                        {catName(a.categoryId)}
                      </span>
                    ) : null}
                    {a.visibility === 'password' ? <span className="text-xs opacity-70">密码</span> : null}
                  </div>
                  {a.summary ? (
                    <div className="mz-post-excerpt">
                      <MarkdownSummary content={a.summary} />
                    </div>
                  ) : null}
                  {!a.coverUrl ? (
                    <span className="mz-post-enter" aria-hidden>
                      <ChevronRight className="size-7" />
                    </span>
                  ) : null}
                </div>
                {a.coverUrl ? (
                  <span className="mz-post-cover">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.coverUrl} alt="" />
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
        {pager}
      </div>
    )
  }

  const avatar = expandUrl(author.avatar)
  const name = author.name || username
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="size-16 rounded-full border object-cover" />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">@{username}</p>
            <p className="mt-2 text-sm text-muted-foreground">共 {res.total} 篇文章</p>
          </div>
        </div>
      </section>

      {intro}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <form action={`/`} className="flex flex-1 gap-2">
          {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
          <Input name="q" defaultValue={keyword || ''} placeholder="搜索文章标题…" className="max-w-sm" />
          <Button type="submit" variant="secondary">
            搜索
          </Button>
        </form>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={blogQuery(username, { q: keyword })}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs transition',
                !categoryId ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              全部
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={blogQuery(username, { q: keyword, categoryId: c.id })}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition',
                  categoryId === c.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {res.list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          还没有公开文章
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {res.list.map((a) => (
            <li key={a.id}>
              <Link
                href={`/${a.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                {a.coverUrl ? (
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.coverUrl} alt="" className="size-full object-cover" />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <time>{formatDateSlash(a.publishedAt || a.createdAt)}</time>
                    {a.pinned ? <Badge variant="secondary">置顶</Badge> : null}
                    {a.visibility === 'password' ? (
                      <span className="rounded bg-muted px-1.5 py-0.5">密码</span>
                    ) : null}
                  </div>
                  <h2 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
                    {a.title}
                  </h2>
                  {a.summary ? (
                    <MarkdownSummary
                      content={a.summary}
                      className="line-clamp-2 flex-1 text-sm text-muted-foreground"
                    />
                  ) : null}
                  <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" />
                      {a.viewCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3.5" />
                      {a.likeCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3.5" />
                      {a.commentCount}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={blogQuery(username, { ...baseQuery, page: page - 1 })}>上一页</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              上一页
            </Button>
          )}
          <span className="flex items-center text-sm text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={blogQuery(username, { ...baseQuery, page: page + 1 })}>下一页</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              下一页
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
