import Link from '@/components/blog/blog-navigation'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { MarkdownSummary } from '@/components/blog/markdown-summary'

export interface ArticleCardData {
  id: number
  slug: string
  title: string
  summary: string
  coverUrl?: string
  publishedAt: number
  tags?: string[]
  viewCount?: number
  likeCount?: number
  visibility?: string
  username: string
}

export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <article className="group flex gap-4 rounded-xl border p-4 transition-colors hover:bg-accent/40">
      {article.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverUrl}
          alt=""
          className="hidden h-28 w-40 shrink-0 rounded-lg object-cover sm:block"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold">
            <Link href={`/${article.slug}`} articleSlug={article.slug} className="hover:text-primary">
              {article.title}
            </Link>
          </h3>
          {article.visibility === 'password' && <Badge variant="secondary">密码</Badge>}
          {article.visibility === 'private' && <Badge variant="outline">私密</Badge>}
        </div>
        {article.summary ? (
          <MarkdownSummary
            content={article.summary}
            className="mt-1 line-clamp-2 text-sm text-muted-foreground"
          />
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(article.publishedAt)}</span>
          {article.tags?.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  )
}
