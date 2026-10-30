const KEY = 'wind-article-preview'

export type ArticlePreview = {
  slug: string
  title: string
  summary: string
  publishedLabel: string
  categoryName: string
  categoryId?: number | null
  publishedAt?: number
  updatedAt?: number
  tags?: string[]
}

export function saveArticlePreview(preview: ArticlePreview) {
  try { sessionStorage.setItem(KEY, JSON.stringify(preview)) } catch { /* Private mode. */ }
}

export function readArticlePreview(slug: string): ArticlePreview | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const preview = JSON.parse(raw) as ArticlePreview
    return preview.slug === slug ? preview : null
  } catch { return null }
}
