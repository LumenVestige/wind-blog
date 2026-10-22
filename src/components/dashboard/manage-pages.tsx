'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { RequestError } from '@/components/ui/request-error'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  AdminStatus,
  useAdminQuery,
} from './admin-ui'
export interface PageItem {
  id: number
  title: string
  slug: string
  contentMd: string
  status: string
  showInNav: boolean
  navLabel: string
  navOrder: number
}
export function ManagePages() {
  const query = useAdminQuery<PageItem[]>('/api/user/blog/page/mine'),
    [target, setTarget] = useState<PageItem | null>(null)
  return (
    <>
      <AdminHeading
        title="静态页面"
        description="管理关于、项目介绍等独立页面。"
        actions={
          <Button asChild>
            <Link href="/manage/pages/new">
              <Plus data-icon="inline-start" />
              新建页面
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-5">
          {query.error ? (
            <RequestError
              error={query.error}
              retry={() => void query.refresh()}
            />
          ) : query.loading ? (
            <AdminLoading />
          ) : !query.data?.length ? (
            <AdminEmpty
              title="还没有静态页面"
              description="点击新建页面开始编辑，保存草稿或发布后会显示在这里。"
              action={
                <Button variant="outline" asChild>
                  <Link href="/manage/pages/new">新建页面</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>页面</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>导航</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-4">
                      <Link
                        className="font-medium hover:underline"
                        href={`/manage/pages/${item.id}/edit`}
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        /p/{item.slug}
                      </p>
                    </TableCell>
                    <TableCell>
                      <AdminStatus
                        tone={
                          item.status === 'published' ? 'success' : 'neutral'
                        }
                      >
                        {item.status === 'published' ? '已发布' : '草稿'}
                      </AdminStatus>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.showInNav ? item.navLabel || item.title : '不显示'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/manage/pages/${item.id}/edit`}>
                            编辑
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/p/${item.slug}`} target="_blank">
                            查看
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`删除页面：${item.title}`}
                          onClick={() => setTarget(item)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ConfirmDelete
        open={!!target}
        title={target?.title || ''}
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          await api.post('/api/user/blog/page/delete', { id: target!.id })
          await query.refresh()
          toast.success('页面已删除')
        }}
      />
    </>
  )
}
