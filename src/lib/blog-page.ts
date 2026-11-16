import type { ArticleReaderProps } from '@/components/blog/article-reader'
import type { ArticleInfo } from '@/server/blog/articles'
import type { HomeLayout } from './blog-layout'

export type BlogCategory = { id: number; name: string; articleCount: number }
export type BlogPageData =
  | { kind: 'home'; username: string; activated: boolean; homeLayout: HomeLayout; categoryId?: number; tags: string[]; keyword?: string; sort?: 'hot';
      page: number; pageSize: number; total: number; categories: BlogCategory[]; list: (ArticleInfo & { summaryHtml: string; thumbnailUrl: string })[] }
  | { kind: 'archives'; categoryName: string; tags: string[]; filtered: boolean; list: ArticleInfo[] }
  | { kind: 'categories'; list: BlogCategory[] }
  | { kind: 'static'; list: { id: number; title: string; publicPath: string; updatedAt: number }[] }
  | { kind: 'page'; title: string; html: string }
  | { kind: 'article'; reader: ArticleReaderProps }

export type BlogPageResponse = { href: string; title: string; page: BlogPageData }

/** Preserve repeated query keys (notably the AND-combined tag filters). */
export function blogSearchParams(values: Record<string, string | string[] | undefined>) {
  const result = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) result.append(key, item)
  }
  return result
}
