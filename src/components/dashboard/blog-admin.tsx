'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, ClientApiError } from '@/lib/api-client'
import { formatDateTime } from '@/lib/utils'

export function BlogAdmin() {
  const [overview, setOverview] = useState<Record<string, number> | null>(null)
  const [articles, setArticles] = useState<Record<string, unknown>[]>([])
  const [authors, setAuthors] = useState<Record<string, unknown>[]>([])
  const [requests, setRequests] = useState<Record<string, unknown>[]>([])
  const [reports, setReports] = useState<Record<string, unknown>[]>([])

  const reload = useCallback(async () => {
    const [ov, ar, au, rq, rp] = await Promise.allSettled([
      api.get<Record<string, number>>('/api/user/blog/admin/overview'),
      api.get<{ list: Record<string, unknown>[] }>('/api/user/blog/admin/articles', { pageSize: 50 }),
      api.get<{ list: Record<string, unknown>[] }>('/api/user/blog/admin/authors', { pageSize: 50 }),
      api.get<{ list: Record<string, unknown>[] }>('/api/user/blog/admin/image-upload/requests', {
        status: 'pending',
      }),
      api.get<{ list: Record<string, unknown>[] }>('/api/user/blog/report/list', { status: 'pending' }),
    ])
    if (ov.status === 'fulfilled') setOverview(ov.value)
    if (ar.status === 'fulfilled') setArticles(ar.value.list || [])
    if (au.status === 'fulfilled') setAuthors(au.value.list || [])
    if (rq.status === 'fulfilled') setRequests(rq.value.list || [])
    if (rp.status === 'fulfilled') setReports(rp.value.list || [])
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function guard(fn: () => Promise<unknown>, okMsg: string) {
    try {
      await fn()
      toast.success(okMsg)
      await reload()
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '操作失败')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">审核</h1>
        <p className="text-sm text-muted-foreground">文章、图片申请和举报。图床与插件在「设置」里配置。</p>
      </div>
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="articles">文章</TabsTrigger>
        <TabsTrigger value="authors">作者</TabsTrigger>
        <TabsTrigger value="requests">图片申请</TabsTrigger>
        <TabsTrigger value="reports">举报</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        {overview && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['开通作者', overview.activatedUsers],
              ['文章', overview.totalArticles],
              ['阅读', overview.totalViews],
              ['点赞', overview.totalLikes],
              ['评论', overview.totalComments],
              ['待审', overview.pendingReview],
              ['驳回', overview.rejected],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="pt-5">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="articles">
        <div className="divide-y rounded-xl border">
          {articles.map((a) => (
            <div key={String(a.id)} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{String(a.title)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(a.authorName || a.username)} · {String(a.visibility)} ·{' '}
                  {String(a.moderationStatus)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  guard(
                    () => api.post('/api/user/blog/admin/moderate', { id: a.id, action: 'approve' }),
                    '已通过',
                  )
                }
              >
                通过
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  guard(
                    () => api.post('/api/user/blog/admin/moderate', { id: a.id, action: 'reject' }),
                    '已驳回',
                  )
                }
              >
                驳回
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  guard(
                    () =>
                      api.post('/api/user/blog/admin/moderate', {
                        id: a.id,
                        action: a.recommend ? 'unfeature' : 'feature',
                      }),
                    '已更新精选',
                  )
                }
              >
                {a.recommend ? '取消精选' : '精选'}
              </Button>
            </div>
          ))}
          {articles.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">暂无文章。</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="authors">
        <div className="divide-y rounded-xl border">
          {authors.map((u) => (
            <div key={String(u.userId)} className="flex items-center gap-3 p-3">
              <span className="flex-1">
                {String(u.name || u.username)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {String(u.username)} · {String(u.articleCount)} 篇
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">图片上传</span>
                <Switch
                  checked={Boolean(u.imageUploadEnabled)}
                  onCheckedChange={(v) =>
                    guard(
                      () =>
                        api.post('/api/user/blog/admin/image-upload', {
                          userId: u.userId,
                          enabled: v,
                        }),
                      '已更新',
                    )
                  }
                />
              </div>
            </div>
          ))}
          {authors.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">暂无作者。</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="requests">
        <div className="divide-y rounded-xl border">
          {requests.map((r) => (
            <div key={String(r.id)} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{String(r.name || r.username)}</p>
                <p className="truncate text-xs text-muted-foreground">{String(r.reason)}</p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  guard(
                    () =>
                      api.post('/api/user/blog/admin/image-upload/review', {
                        id: r.id,
                        action: 'approve',
                      }),
                    '已通过',
                  )
                }
              >
                通过
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  guard(
                    () =>
                      api.post('/api/user/blog/admin/image-upload/review', {
                        id: r.id,
                        action: 'reject',
                      }),
                    '已驳回',
                  )
                }
              >
                驳回
              </Button>
            </div>
          ))}
          {requests.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">暂无待审申请。</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="reports">
        <div className="divide-y rounded-xl border">
          {reports.map((r) => {
            const target = (r.target || {}) as Record<string, unknown>
            return (
              <div key={String(r.id)} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{String(target.title || '(文章已删除)')}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    理由：{String(r.reason)} · {formatDateTime(Number(r.createdAt))}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    guard(
                      () => api.post('/api/user/blog/report/handle', { id: r.id, action: 'resolve' }),
                      '已处理',
                    )
                  }
                >
                  处理
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    guard(
                      () => api.post('/api/user/blog/report/handle', { id: r.id, action: 'dismiss' }),
                      '已驳回',
                    )
                  }
                >
                  忽略
                </Button>
              </div>
            )
          })}
          {reports.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">暂无举报。</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
    </div>
  )
}
