'use client'
import Link from 'next/link'
import { AnimatedNumber } from '@/components/motion/animated-number'
import {
  ArrowRight,
  Eye,
  Files,
  Heart,
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
import { AdminHeading, AdminLoading, useAdminQuery } from './admin-ui'
interface Overview {
  totalArticles: number
  totalViews: number
  totalLikes: number
  topArticles: { id: number; title: string; slug: string; viewCount: number }[]
}
export function ManageOverview() {
  const stats = useAdminQuery<Overview>('/api/user/blog/analytics')
  return (
    <>
      <AdminHeading title="工作台" description="从这里开始管理内容与站点。" />
      {stats.error ? (
        <RequestError error={stats.error} retry={() => void stats.refresh()} />
      ) : stats.loading ? (
        <AdminLoading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: '文章', value: stats.data?.totalArticles, icon: Files },
            { label: '累计阅读', value: stats.data?.totalViews, icon: Eye },
            { label: '点赞', value: stats.data?.totalLikes, icon: Heart },
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
      <Card>
        <CardHeader>
          <CardTitle>继续创作</CardTitle>
          <CardDescription>撰写新内容，或继续编辑已有文章。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
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
