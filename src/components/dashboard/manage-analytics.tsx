'use client'
import Link from 'next/link'
import { Eye, Files, Heart, MessageSquare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RequestError } from '@/components/ui/request-error'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  useAdminQuery,
} from './admin-ui'
interface Analytics {
  totalArticles: number
  totalViews: number
  totalLikes: number
  totalComments: number
  topArticles: {
    id: number
    slug: string
    title: string
    viewCount: number
    likeCount: number
    commentCount: number
  }[]
}
export function ManageAnalytics({ username }: { username: string }) {
  const query = useAdminQuery<Analytics>('/api/user/blog/analytics')
  return (
    <>
      <AdminHeading
        title="数据概览"
        description="了解内容的累计阅读与互动表现。"
        actions={
          <Button
            variant="outline"
            disabled={query.loading}
            onClick={() => void query.refresh()}
          >
            <RefreshCw data-icon="inline-start" />
            刷新
          </Button>
        }
      />
      {query.error ? (
        <RequestError error={query.error} retry={() => void query.refresh()} />
      ) : query.loading ? (
        <AdminLoading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: '文章数',
                value: query.data?.totalArticles,
                icon: Files,
              },
              { label: '阅读量', value: query.data?.totalViews, icon: Eye },
              { label: '点赞数', value: query.data?.totalLikes, icon: Heart },
              {
                label: '留言数',
                value: query.data?.totalComments,
                icon: MessageSquare,
              },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardDescription>{item.label}</CardDescription>
                  <item.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <strong className="text-3xl font-semibold tabular-nums">
                    {(item.value || 0).toLocaleString()}
                  </strong>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>热门文章</CardTitle>
              <CardDescription>按累计阅读量排序。</CardDescription>
            </CardHeader>
            <CardContent>
              {!query.data?.topArticles.length ? (
                <AdminEmpty title="暂时没有文章数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">排名</TableHead>
                      <TableHead>文章</TableHead>
                      <TableHead className="text-right">阅读</TableHead>
                      <TableHead className="text-right">点赞</TableHead>
                      <TableHead className="text-right">留言</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.topArticles.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/${item.slug}`}
                            target="_blank"
                            className="font-medium hover:underline"
                          >
                            {item.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.viewCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.likeCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.commentCount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
