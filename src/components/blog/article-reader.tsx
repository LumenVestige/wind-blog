'use client'

import { useEffect, useRef, useState } from 'react'
import { useBlogRouter } from './blog-navigation'
import { api, ClientApiError } from '@/lib/api-client'
import { ArticleBodyContent, ArticleView, type ArticleViewData } from './article-view'
import { ArticleNav, type ArticleNavData } from './article-nav'
import type { TocItem } from './article-toc'

type Counts = Pick<ArticleViewData, 'viewCount' | 'likeCount' | 'commentCount' | 'liked'>
export type ArticleReaderProps = {
  themeId: 'mizuki' | 'chirpy' | 'simple'
  username: string
  article: ArticleViewData
  toc: TocItem[]
  revision: string
  countRead: boolean
  adjacent: ArticleNavData
  isOwner: boolean
  viewerId: number
  isAdmin: boolean
}

/** Initial HTML comes from SSR; later navigations supply the same props via JSON.
 * Record a visit only when this reader mounts, never during prefetch.
 */
export function ArticleReader({ article, toc, revision, countRead, adjacent, ...props }: ArticleReaderProps) {
  const router = useBlogRouter()
  const key = `${article.id}:${article.updatedAt}:${revision}:${article.requiresPassword}`
  const pending = useRef<{ key: string; promise: Promise<Counts> } | null>(null)
  const [counts, setCounts] = useState<{ key: string; value: Counts } | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)

  useEffect(() => {
    if (!countRead || article.requiresPassword) return
    if (pending.current?.key !== key) {
      pending.current = { key, promise: api.post<Counts>('/api/blog/article/read', { id: article.id, updatedAt: article.updatedAt, revision }) }
    }
    let cancelled = false
    void pending.current.promise.then((value) => {
      if (!cancelled) setCounts({ key, value })
    }, (error) => {
      if (!cancelled && error instanceof ClientApiError && [403, 404, 409].includes(error.status)) {
        // A previously prefetched page may have been edited or protected. Do
        // not keep displaying stale content while the server rechecks access.
        setInvalid(key)
        router.refresh()
      }
    })
    return () => { cancelled = true }
  }, [article.id, article.updatedAt, article.requiresPassword, countRead, key, revision, router.refresh])

  const current = counts?.key === key ? { ...article, ...counts.value } : article
  const body = invalid === key
    ? <p role="status" className="py-6 text-muted-foreground">正在重新加载文章…</p>
    : <ArticleBodyContent themeId={props.themeId} html={article.html} toc={toc} locked={article.requiresPassword} articleId={article.id} />
  return <>
    <ArticleView {...props} article={current} toc={toc} related={[]} bodySlot={body} />
    {props.themeId === 'mizuki' && !article.requiresPassword && invalid !== key
      ? <ArticleNav username={props.username} slug={article.slug} initialData={adjacent} />
      : null}
  </>
}
