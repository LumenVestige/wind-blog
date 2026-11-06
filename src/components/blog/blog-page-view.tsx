'use client'

import { Calendar, ChevronRight, Eye, FolderOpen, Heart, Tag, X } from 'lucide-react'
import type { BlogPageData } from '@/lib/blog-page'
import { blogQuery, formatDateCn, formatDateSlash } from '@/lib/blog-present'
import { Badge } from '@/components/ui/badge'
import Link from './blog-navigation'
import { ArticleLink } from './article-link'
import { ArticleReader } from './article-reader'
import { BlogPagination } from './blog-pagination'
import { FeedSearch } from './feed-search'
import { FeedTabs } from './feed-tabs'
import { MarkdownView } from './markdown-view'

function Home({ data }: { data: Extract<BlogPageData, { kind: 'home' }> }) {
  const { username, categoryId, tags, keyword, sort, categories, list, page, pageSize, total } = data
  if (!data.activated) return <p className="text-muted-foreground">此用户还没有开通博客。</p>
  const catName = (id?: number | null) => categories.find((c) => c.id === id)?.name || ''
  const activeCat = catName(categoryId)
  const baseQuery = { q: keyword, categoryId, tag: tags, sort }
  return <div>
    <div className="mz-feed-toolbar">
      <div className="mz-feed-toolbar-start">
        <FeedTabs sort={sort} items={[
          { label: '最新', href: blogQuery(username, { ...baseQuery, sort: undefined }) },
          { label: '热门', sort: 'hot', href: blogQuery(username, { ...baseQuery, sort: 'hot' }) },
        ]} />
        {categoryId ? <span className="mz-feed-filter"><FolderOpen aria-hidden /><span className="truncate">{activeCat || `分类 ${categoryId}`}</span>
          <Link href={blogQuery(username, { ...baseQuery, categoryId: undefined })} className="mz-feed-filter-clear" aria-label={`取消分类筛选：${activeCat || categoryId}`} title="取消分类筛选"><X /></Link>
        </span> : null}
        {tags.map((tag) => <span key={tag} className="mz-feed-filter"><Tag aria-hidden /><span className="truncate">{tag}</span>
          <Link href={blogQuery(username, { ...baseQuery, tag: tags.filter((item) => item !== tag) })} className="mz-feed-filter-clear" aria-label={`取消标签筛选：${tag}`} title="取消标签筛选"><X /></Link>
        </span>)}
      </div>
      <FeedSearch keyword={keyword || ''} clearHref={blogQuery(username, { ...baseQuery, q: undefined })} hidden={{ categoryId, tag: tags, sort }} />
    </div>
    {list.length === 0 ? <div className="mz-empty" data-feed-list>{keyword || categoryId || tags.length ? '没有找到匹配的文章，请调整筛选条件。' : '还没有公开文章'}</div> :
      <div className="mz-feed-grid" data-feed-list>{list.map((article) => <ArticleLink key={article.id} className="mz-feed-card" preview={{
        slug: article.slug, title: article.title, summary: article.summary, publishedLabel: formatDateSlash(article.publishedAt || article.createdAt),
        categoryName: catName(article.categoryId), categoryId: article.categoryId, publishedAt: article.publishedAt || article.createdAt, updatedAt: article.updatedAt, tags: article.tags,
      }}>
        <div className="mz-feed-body">
          <h2 className="mz-feed-title"><span className="mz-feed-title-text">{article.title}</span><ChevronRight className="mz-feed-enter" aria-hidden="true" /></h2>
          <div className="mz-feed-preview">
            <div className="mz-feed-excerpt">{article.summaryHtml ? <div className="markdown-summary min-w-0 max-w-full [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: article.summaryHtml }} /> : null}</div>
            {article.coverUrl ? <span className="mz-feed-cover"><img src={article.thumbnailUrl} alt="" loading="lazy" /></span> : null}
          </div>
          <div className="mz-feed-stats">
            <span><Calendar /><time>{formatDateCn(article.publishedAt || article.createdAt)}</time></span>
            <span><Eye />{article.viewCount}</span><span><Heart />{article.likeCount}</span>
            {article.pinned && !sort ? <Badge variant="secondary">置顶</Badge> : null}
            {article.visibility === 'password' ? <span className="opacity-70">密码</span> : null}
          </div>
        </div>
      </ArticleLink>)}</div>}
    <BlogPagination page={page} total={total} pageSize={pageSize} href={blogQuery(username, baseQuery)} label="文章列表分页" />
  </div>
}

function Archives({ data }: { data: Extract<BlogPageData, { kind: 'archives' }> }) {
  const groups = new Map<number, typeof data.list>()
  for (const article of data.list) {
    const year = new Date((article.publishedAt || article.createdAt) * 1000).getFullYear()
    if (!groups.has(year)) groups.set(year, [])
    groups.get(year)!.push(article)
  }
  return <div className="mz-archive-panel" id="archives">
    <h1 className="sr-only">{data.categoryName ? `${data.categoryName} · ` : ''}{data.tags.length ? `${data.tags.join('、')} · ` : ''}文章归档</h1>
    {!groups.size ? <div className="mz-archive-empty">{data.filtered ? '这个分类或标签下还没有文章' : '还没有文章'}</div> :
      [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, articles]) => <section key={year} aria-label={`${year} 年`}>
        <div className="mz-archive-year"><h2>{year}</h2><span className="mz-archive-year-marker" aria-hidden="true" /><span className="mz-archive-count">{articles.length} 篇文章</span></div>
        <ul className="mz-archive-list">{articles.map((article) => {
          const date = new Date((article.publishedAt || article.createdAt) * 1000)
          return <li key={article.id}><Link href={`/${article.slug}`} articleSlug={article.slug} className="mz-archive-row" aria-label={article.title} title={article.title}>
            <time className="date" dateTime={date.toISOString()}>{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')}</time>
            <span className="mz-archive-dot" aria-hidden="true" /><span className="mz-archive-title">{article.title}</span>
            <span className="mz-archive-tags" aria-hidden="true">{article.tags.map((tag) => `#${tag}`).join(' ')}</span>
          </Link></li>
        })}</ul>
      </section>)}
  </div>
}

/** The same components produce initial HTML and render subsequent JSON data. */
export function BlogPageView({ data }: { data: BlogPageData }) {
  switch (data.kind) {
    case 'home': return <Home data={data} />
    case 'article': return <ArticleReader key={`${data.reader.article.id}:${data.reader.revision}:${data.reader.article.requiresPassword}`} {...data.reader} />
    case 'archives': return <Archives data={data} />
    case 'page': return <article className="mz-article"><h1>{data.title}</h1><div className="mz-prose"><MarkdownView html={data.html} className="" /></div></article>
    case 'categories': return <div><h1 className="mz-page-title">分类</h1>{!data.list.length ? <div className="mz-empty">还没有分类</div> :
      <div className="grid gap-3 sm:grid-cols-2">{data.list.map((category) => <Link key={category.id} href={`/?categoryId=${category.id}`} className="mz-cat-card">
        <span className="inline-flex items-center gap-2"><FolderOpen className="size-4 opacity-70" />{category.name}</span><span>{category.articleCount ?? 0} 篇</span>
      </Link>)}</div>}</div>
    case 'static': {
      const groups = new Map<number, typeof data.list>()
      for (const site of data.list) {
        const year = new Date(site.updatedAt * 1000).getFullYear()
        if (!groups.has(year)) groups.set(year, [])
        groups.get(year)!.push(site)
      }
      return <div className="mz-article space-y-6"><h1 className="mz-page-title">静态页</h1>{!groups.size ?
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">还没有公开的静态页</div> :
        [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, sites]) => <section key={year} className="space-y-2">
          <h2 className="text-lg font-semibold">{year}</h2><ol className="space-y-3 border-l pl-4">{sites.map((site) => {
            const date = new Date(site.updatedAt * 1000)
            return <li key={site.id} className="flex gap-3"><time className="w-12 shrink-0 text-sm text-muted-foreground">{String(date.getMonth() + 1).padStart(2, '0')}/{String(date.getDate()).padStart(2, '0')}</time>
              <a href={site.publicPath} target="_blank" rel="noreferrer" className="hover:text-primary">{site.title}</a></li>
          })}</ol>
        </section>)}</div>
    }
  }
}
