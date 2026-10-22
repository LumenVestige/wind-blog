'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Eye, Heart, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RequestError } from '@/components/ui/request-error'
import { api, ClientApiError } from '@/lib/api-client'

interface Article {
  id: number
  slug: string
  title: string
  visibility: string
  isDraft: boolean
  recommend: boolean
  viewCount: number
  likeCount: number
  commentCount: number
}

const visLabel: Record<string, string> = {
  public: '公开',
  password: '密码',
  private: '私密',
}

export function ManageArticles({ username }: { username: string }) {
  const [list, setList] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [keyword, setKeyword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pageSize, setPageSize] = useState(15)
  const manage = `/manage`

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ list: Article[]; total: number }>('/api/user/blog/article/mine', {
        page,
        pageSize,
        keyword: keyword || undefined,
      })
      setList(res.list || [])
      setTotal(res.total || 0)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, keyword])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.post('/api/user/blog/article/delete', { id: deleteTarget.id })
      toast.success('已删除')
      setDeleteTarget(null)
      if (list.length === 1 && page > 1) setPage(p => p - 1); else await load()
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '没删掉')
    } finally {
      setDeleting(false)
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">文章管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 篇</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href={`${manage}/new`}>
            <Plus className="size-4" />
            写文章
          </Link>
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setKeyword(q.trim())
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索我的文章…"
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          搜索
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          每页
          <select
            aria-label="每页行数"
            className="rounded-md border bg-background px-2 py-1.5 text-foreground"
            value={pageSize}
            onChange={(e) => {
              setPage(1)
              setPageSize(Number(e.target.value))
            }}
          >
            {[15, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </form>

      {error ? <RequestError error={error} retry={() => void load()} /> : loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {keyword ? `没有找到与「${keyword}」匹配的文章` : '还没有文章，点「写文章」发一篇吧'}
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`${manage}/edit/${a.id}`} className="font-medium hover:text-primary">
                  {a.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{a.isDraft ? '草稿' : visLabel[a.visibility] || a.visibility}</span>
                  {a.recommend ? <span>推荐</span> : null}
                  <span className="inline-flex items-center gap-0.5">
                    <Eye className="size-3" />
                    {a.viewCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Heart className="size-3" />
                    {a.likeCount ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageCircle className="size-3" />
                    {a.commentCount ?? 0}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${a.slug}`}>查看</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${manage}/edit/${a.id}`}>编辑</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  aria-label="删除"
                  onClick={() => setDeleteTarget({ id: a.id, title: a.title })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文章？</DialogTitle>
            <DialogDescription>要把「{deleteTarget?.title}」删掉吗？删了找不回来。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
