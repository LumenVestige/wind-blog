'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatDateTime } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RequestError } from '@/components/ui/request-error'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  AdminPagination,
  useAdminQuery,
} from './admin-ui'
interface Comment {
  id: number
  content: string
  author: { name: string }
  articleTitle: string
  slug: string
  createdAt: number
  parentId: number
}
export function ManageComments() {
  const params = useSearchParams(),
    router = useRouter(),
    status = params.get('status') === 'approved' ? 'approved' : 'pending',
    page = Math.max(1, Number(params.get('page')) || 1),
    keyword = params.get('q') || ''
  const [q, setQ] = useState(keyword),
    [busy, setBusy] = useState<number | null>(null),
    [target, setTarget] = useState<Comment | null>(null)
  const query = useAdminQuery<{ list: Comment[]; total: number }>(
    '/api/manage/comments',
    { status, keyword, page, pageSize: 20 },
  )
  useEffect(() => setQ(keyword), [keyword])
  function navigate(patch: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === '1' || value === 'pending') next.delete(key)
      else next.set(key, value)
    }
    router.push('/manage/comments' + (next.size ? `?${next}` : ''))
  }
  async function approve(comment: Comment) {
    setBusy(comment.id)
    try {
      await api.post('/api/user/blog/comment/approve', { id: comment.id })
      await query.refresh()
      toast.success('留言已公开')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '审核失败')
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <AdminHeading
        title="留言管理"
        description="审核访客的新留言，管理已公开的交流。"
      />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          <Tabs
            value={status}
            onValueChange={(status) => navigate({ status, page: '1' })}
          >
            <TabsList>
              <TabsTrigger value="pending">待审核</TabsTrigger>
              <TabsTrigger value="approved">已公开</TabsTrigger>
            </TabsList>
          </Tabs>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              navigate({ q: q.trim(), page: '1' })
            }}
          >
            <Input
              aria-label="搜索留言"
              placeholder="搜索留言、昵称或文章"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
            <Button variant="outline" type="submit">
              <Search />
              搜索
            </Button>
          </form>
          {query.error ? (
            <RequestError
              error={query.error}
              retry={() => void query.refresh()}
            />
          ) : query.loading ? (
            <AdminLoading />
          ) : !query.data?.list.length ? (
            <AdminEmpty
              title={
                keyword
                  ? '没有匹配的留言'
                  : status === 'pending'
                    ? '没有待审核留言'
                    : '还没有公开留言'
              }
            />
          ) : (
            <div className="divide-y">
              {query.data.list.map((comment) => (
                <article key={comment.id} className="flex gap-3 py-5">
                  <Avatar className="size-9">
                    <AvatarFallback>
                      {comment.author.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-medium">
                        {comment.author.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {comment.parentId ? '回复' : '留言'}
                        </span>
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {comment.content}
                    </p>
                    <Link
                      href={`/${comment.slug}`}
                      target="_blank"
                      className="text-xs text-muted-foreground underline underline-offset-4"
                    >
                      来自：{comment.articleTitle}
                    </Link>
                    <div className="flex gap-2">
                      {status === 'pending' && (
                        <Button
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void approve(comment)}
                        >
                          <Check data-icon="inline-start" />
                          {busy === comment.id ? '公开中…' : '通过并公开'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setTarget(comment)}
                      >
                        <Trash2 data-icon="inline-start" />
                        删除
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <AdminPagination
            page={page}
            pageSize={20}
            total={query.data?.total || 0}
            disabled={query.loading}
            onChange={(page) => navigate({ page: String(page) })}
          />
        </CardContent>
      </Card>
      <ConfirmDelete
        open={!!target}
        title="这条留言"
        description="留言及其回复将被删除，操作无法恢复。"
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          await api.post('/api/user/blog/comment/delete', { id: target!.id })
          if (query.data?.list.length === 1 && page > 1)
            navigate({ page: String(page - 1) })
          else await query.refresh()
          toast.success('留言已删除')
        }}
      />
    </>
  )
}
