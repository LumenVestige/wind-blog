'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RequestError } from '@/components/ui/request-error'
import { api } from '@/lib/api-client'

interface Analytics {
  totalArticles: number
  totalViews: number
  totalLikes: number
  totalComments: number
  topArticles: { id: number; slug: string; title: string; viewCount: number; likeCount: number; commentCount: number }[]
}

export function ManageAnalytics({ username }: { username: string }) {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<unknown>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await api.get<Analytics>('/api/user/blog/analytics')) } catch (e) { setError(e) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])

  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground">加载中…</div>

  if (error) return <RequestError error={error} retry={() => void load()} />

  const cards = [
    { label: '文章数', value: data?.totalArticles ?? 0 },
    { label: '总阅读', value: data?.totalViews ?? 0 },
    { label: '总点赞', value: data?.totalLikes ?? 0 },
    { label: '总评论', value: data?.totalComments ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">数据概览</h1>
        <p className="text-sm text-muted-foreground">阅读、点赞与评论的基础统计</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3 font-medium">阅读最多的文章</div>
        <ul className="divide-y">
          {(data?.topArticles || []).length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">还没有数据</li>
          ) : (
            data!.topArticles.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/${a.slug}`} className="font-medium hover:text-primary">
                  {a.title}
                </Link>
                <span className="text-muted-foreground">
                  {a.viewCount} 阅读 · {a.likeCount} 赞 · {a.commentCount} 评
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
      <Button variant="outline" asChild>
        <Link href={`/manage`}>返回管理</Link>
      </Button>
    </div>
  )
}
