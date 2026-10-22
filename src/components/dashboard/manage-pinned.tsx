'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Pin, PinOff } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RequestError } from '@/components/ui/request-error'
import { api, ClientApiError } from '@/lib/api-client'
import { cn, formatDate } from '@/lib/utils'

interface Article {
  id: number
  title: string
  visibility: string
  pinned: boolean
  pinnedAt: number
}

const visLabel: Record<string, string> = { public: '公开', password: '密码', private: '私密' }

export function ManagePinned() {
  const [pinnedError, setPinnedError] = useState<unknown>(null)
  const [articlesError, setArticlesError] = useState<unknown>(null)
  const [pinned, setPinned] = useState<Article[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loadingPinned, setLoadingPinned] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragFrom = useRef<number | null>(null)
  const pageSize = 10

  const loadPinned = useCallback(async () => {
    setLoadingPinned(true)
    setPinnedError(null)
    try {
      const res = await api.get<Article[]>('/api/user/blog/article/pinned/mine')
      setPinned(Array.isArray(res) ? res : [])
    } catch (e) {
      setPinnedError(e)
    } finally {
      setLoadingPinned(false)
    }
  }, [])

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true)
    setArticlesError(null)
    try {
      const res = await api.get<{ list: Article[]; total: number }>('/api/user/blog/article/mine', {
        page,
        pageSize,
        keyword: keyword || undefined,
      })
      setArticles(res.list || [])
      setTotal(res.total || 0)
    } catch (e) {
      setArticlesError(e)
    } finally {
      setLoadingArticles(false)
    }
  }, [page, keyword])

  useEffect(() => {
    void loadPinned()
  }, [loadPinned])

  useEffect(() => {
    void loadArticles()
  }, [loadArticles])

  async function togglePinned(article: Article, next: boolean) {
    setPendingId(article.id)
    try {
      await api.post('/api/user/blog/article/pin', { id: article.id, pinned: next })
      toast.success(next ? '已置顶' : '已取消置顶')
      await Promise.all([loadPinned(), loadArticles()])
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '操作失败')
    } finally {
      setPendingId(null)
    }
  }

  async function commitOrder(next: Article[], previous: Article[]) {
    setPinned(next)
    setReordering(true)
    try {
      await api.post('/api/user/blog/article/pinned/reorder', { articleIds: next.map((a) => a.id) })
    } catch (e) {
      setPinned(previous)
      toast.error(e instanceof ClientApiError ? e.message : '顺序没保存上')
    } finally {
      setReordering(false)
    }
  }

  function move(from: number, to: number) {
    if (pendingId !== null || reordering || from === to || to < 0 || to >= pinned.length) return
    const previous = pinned
    const next = [...pinned]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    void commitOrder(next, previous)
  }

  const pinnedIds = new Set(pinned.map((a) => a.id))
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">文章置顶</h1>
          <p className="text-sm text-muted-foreground">拖动文章调整博客首页顺序</p>
        </div>
        <Badge variant="secondary">已置顶 {pinned.length} 篇</Badge>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>置顶文章</CardTitle>
            <CardDescription>拖放或使用箭头调整，修改后自动保存。</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {pinnedError ? <RequestError error={pinnedError} retry={() => void loadPinned()} /> : loadingPinned ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">加载中…</p>
            ) : pinned.length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">还没有置顶文章。从右侧列表里选。</p>
            ) : (
              <ol className={cn('divide-y', reordering && 'opacity-70')}>
                {pinned.map((article, index) => (
                  <li
                    key={article.id}
                    draggable={pendingId === null && !reordering}
                    onDragStart={() => {
                      dragFrom.current = index
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOver(index)
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(event) => {
                      event.preventDefault()
                      const from = dragFrom.current
                      dragFrom.current = null
                      setDragOver(null)
                      if (from !== null) move(from, index)
                    }}
                    onDragEnd={() => {
                      dragFrom.current = null
                      setDragOver(null)
                    }}
                    className={cn('flex items-center gap-2 px-4 py-3', dragOver === index && 'bg-muted')}
                  >
                    <span className="flex size-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground">
                      <GripVertical className="size-4" />
                    </span>
                    <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{article.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{visLabel[article.visibility] || article.visibility}</Badge>
                        {article.pinnedAt ? <span>{formatDate(article.pinnedAt)} 置顶</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" disabled={index === 0 || reordering} aria-label="上移" onClick={() => move(index, index - 1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={index === pinned.length - 1 || reordering}
                        aria-label="下移"
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="取消置顶" disabled={pendingId !== null || reordering} onClick={() => void togglePinned(article, false)}>
                        <PinOff className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>添加文章</CardTitle>
            <CardDescription>公开和密码文章可以置顶。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setPage(1)
                setKeyword(query.trim())
              }}
            >
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索文章…" />
              <Button type="submit" variant="secondary">
                搜索
              </Button>
            </form>
            {articlesError ? <RequestError error={articlesError} retry={() => void loadArticles()} /> : loadingArticles ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : articles.length === 0 ? (
              <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">没有找到文章</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {articles.map((article) => {
                  const eligible = article.visibility === 'public' || article.visibility === 'password'
                  const isPinned = pinnedIds.has(article.id)
                  return (
                    <li key={article.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{article.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline">{visLabel[article.visibility] || article.visibility}</Badge>
                          {!eligible ? <span className="text-xs text-muted-foreground">不可置顶</span> : null}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!eligible || isPinned || pendingId !== null || reordering}
                        onClick={() => void togglePinned(article, true)}
                      >
                        <Pin className="size-3.5" />
                        {isPinned ? '已置顶' : '置顶'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            {total > pageSize && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {pages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
