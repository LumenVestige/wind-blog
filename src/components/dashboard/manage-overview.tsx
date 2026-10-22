'use client'
import Link from 'next/link'
import { AnimatedNumber } from '@/components/motion/animated-number'
import {
  ArrowRight,
  Eye,
  Files,
  Heart,
  MessageSquare,
  PenLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RequestError } from '@/components/ui/request-error'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  useAdminQuery,
} from './admin-ui'
interface Overview {
  totalArticles: number
  totalViews: number
  totalLikes: number
  totalComments: number
  topArticles: { id: number; title: string; slug: string; viewCount: number }[]
}
export function ManageOverview() {
  const stats = useAdminQuery<Overview>('/api/user/blog/analytics')
  const pending = useAdminQuery<{ list: unknown[] }>(
    '/api/user/blog/comment/pending',
  )
  return (
    <>
      <AdminHeading title="工作台" description="从这里开始管理内容与站点。" />
      {stats.error ? (
        <RequestError error={stats.error} retry={() => void stats.refresh()} />
      ) : stats.loading ? (
        <AdminLoading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '文章', value: stats.data?.totalArticles, icon: Files },
            { label: '累计阅读', value: stats.data?.totalViews, icon: Eye },
            { label: '点赞', value: stats.data?.totalLikes, icon: Heart },
            {
              label: '留言',
              value: stats.data?.totalComments,
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
                  <AnimatedNumber value={item.value || 0} />
                </strong>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>继续创作</CardTitle>
            <CardDescription>撰写新内容，或继续编辑已有文章。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/manage/new">
                <PenLine data-icon="inline-start" />
                写文章
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/manage/articles?status=draft">
                打开草稿箱
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/manage/articles">
                管理全部文章
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>待办事项</CardTitle>
            <CardDescription>需要你处理的访客留言。</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.error ? (
              <RequestError
                error={pending.error}
                retry={() => void pending.refresh()}
              />
            ) : pending.loading ? (
              <AdminLoading />
            ) : pending.data?.list.length ? (
              <div className="flex flex-col gap-4">
                <p>
                  <strong className="text-3xl font-semibold">
                    {pending.data.list.length}
                  </strong>
                  <span className="ml-2 text-sm text-muted-foreground">
                    条留言等待审核
                  </span>
                </p>
                <Button asChild variant="outline">
                  <Link href="/manage/comments">
                    前往审核
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            ) : (
              <AdminEmpty
                title="暂时没有待办"
                description="新留言会出现在这里。"
              />
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>常用入口</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            {
              href: '/manage/pages',
              title: '静态页面',
              text: '关于、项目等独立内容',
            },
            {
              href: '/manage/static-sites',
              title: '静态站点',
              text: '上传与管理 ZIP 站点',
            },
            {
              href: '/manage/settings',
              title: '站点设置',
              text: '外观、互动与存储',
            },
          ].map((item) => (
            <Button
              variant="outline"
              asChild
              key={item.href}
              className="h-auto justify-start py-4"
            >
              <Link href={item.href}>
                <span className="flex flex-col gap-1">
                  <span>{item.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {item.text}
                  </span>
                </span>
                <ArrowRight className="ml-auto" />
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
