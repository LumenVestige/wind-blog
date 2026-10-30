'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, MoreHorizontal, Pin, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RequestError } from '@/components/ui/request-error'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  AdminPagination,
  AdminStatus,
  useAdminQuery,
} from './admin-ui'
import { parsePage, parsePageSize } from '@/lib/pagination'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
interface Article {
  id: number
  slug: string
  title: string
  visibility: string
  isDraft: boolean
  pinned: boolean
  viewCount: number
  likeCount: number
  commentCount: number
  updatedAt: number
}
export function ManageArticles({ username }: { username: string }) {
  const params = useSearchParams(),
    router = useRouter(),
    keyword = params.get('q') || '',
    status = ['all', 'public', 'unlisted', 'draft', 'password', 'private'].includes(
      params.get('status') || '',
    )
      ? params.get('status')!
      : 'all',
    page = parsePage(params.get('page')),
    pageSize = parsePageSize(params.get('pageSize'))
  const [query, setQuery] = useState(keyword),
    [target, setTarget] = useState<Article | null>(null),
    [busy, setBusy] = useState(false)
  const { data, error, loading, refresh } = useAdminQuery<{
    list: Article[]
    total: number
  }>('/api/user/blog/article/mine', {
    page,
    pageSize,
    keyword,
    status: status === 'all' ? undefined : status,
  })
  useEffect(() => setQuery(keyword), [keyword])
  useEffect(() => {
    if (loading || error || !data) return
    const last = Math.max(1, Math.ceil(data.total / pageSize))
    if (page <= last) return
    const next = new URLSearchParams(params)
    next.set('page', String(last))
    router.replace('/manage/articles?' + next)
  }, [loading, error, data, page, pageSize, params, router])
  function navigate(patch: Record<string, string>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === 'all' || (key === 'page' && value === '1'))
        next.delete(key)
      else next.set(key, value)
    }
    router.push('/manage/articles' + (next.size ? `?${next}` : ''))
  }
  return (
    <>
      <AdminHeading
        title={status === 'draft' ? '草稿箱' : '文章'}
        description="管理文章的编辑、发布与可见性。"
      />
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          <Tabs
            value={status}
            onValueChange={(status) => navigate({ status, page: '1' })}
          >
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="public">公开</TabsTrigger>
              <TabsTrigger value="unlisted">仅链接可见</TabsTrigger>
              <TabsTrigger value="draft">草稿</TabsTrigger>
              <TabsTrigger value="password">密码保护</TabsTrigger>
              <TabsTrigger value="private">私密</TabsTrigger>
            </TabsList>
          </Tabs>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              navigate({ q: query.trim(), page: '1' })
            }}
          >
            <Input
              aria-label="搜索文章"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题或正文"
            />
            <Button type="submit" variant="outline">
              <Search data-icon="inline-start" />
              搜索
            </Button>
          </form>
          {error ? (
            <RequestError error={error} retry={() => void refresh()} />
          ) : loading ? (
            <AdminLoading />
          ) : !data?.list.length ? (
            <AdminEmpty
              title={
                keyword
                  ? '没有匹配的文章'
                  : status === 'draft'
                    ? '草稿箱为空'
                    : '还没有文章'
              }
              description={
                keyword
                  ? '试试其他关键词，或清除筛选。'
                  : '从写下第一篇文章开始。'
              }
              action={
                <Button variant="outline" asChild>
                  <Link href="/manage/new">写文章</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="hidden lg:table-cell">互动</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.list.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-xs py-4">
                      <Link
                        href={`/manage/edit/${article.id}`}
                        className="font-medium hover:underline"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {article.updatedAt ? formatDate(article.updatedAt) : ''}
                        {article.pinned && ' · 已置顶'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <AdminStatus
                        tone={
                          article.isDraft
                            ? 'neutral'
                            : article.visibility === 'public'
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {article.isDraft
                          ? '草稿'
                          : article.visibility === 'public'
                            ? '已公开'
                            : article.visibility === 'unlisted'
                              ? '仅链接可见'
                            : article.visibility === 'password'
                              ? '密码保护'
                              : '私密'}
                      </AdminStatus>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">
                      {article.viewCount} 阅读 · {article.likeCount} 赞 ·{' '}
                      {article.commentCount} 留言
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/manage/edit/${article.id}`}>编辑</Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`更多操作：${article.title}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem asChild>
                                <Link href={`/${article.slug}`} target="_blank">
                                  <Eye />
                                  查看文章
                                </Link>
                              </DropdownMenuItem>
                              {!article.isDraft &&
                                ['public', 'password'].includes(article.visibility) && (
                                  <DropdownMenuItem
                                    disabled={busy}
                                    onSelect={async () => {
                                      setBusy(true)
                                      try {
                                        await api.post(
                                          '/api/user/blog/article/pin',
                                          {
                                            id: article.id,
                                            pinned: !article.pinned,
                                          },
                                        )
                                        await refresh()
                                        toast.success(
                                          article.pinned
                                            ? '已取消置顶'
                                            : '文章已置顶',
                                        )
                                      } catch (error) {
                                        toast.error(
                                          error instanceof Error
                                            ? error.message
                                            : '操作失败',
                                        )
                                      } finally {
                                        setBusy(false)
                                      }
                                    }}
                                  >
                                    <Pin />
                                    {article.pinned ? '取消置顶' : '设为置顶'}
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuItem
                                onSelect={() => setTarget(article)}
                              >
                                <Trash2 />
                                删除文章
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <AdminPagination
            page={page}
            total={data?.total || 0}
            pageSize={pageSize}
            disabled={loading || !!error}
            onChange={(page) => navigate({ page: String(page) })}
            onPageSizeChange={(size) =>
              navigate({ pageSize: String(size), page: '1' })
            }
          />
        </CardContent>
      </Card>
      <ConfirmDelete
        title={target?.title || ''}
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          await api.post('/api/user/blog/article/delete', { id: target!.id })
          toast.success('文章已删除')
          if (data?.list.length === 1 && page > 1)
            navigate({ page: String(page - 1) })
          else await refresh()
        }}
      />
    </>
  )
}
