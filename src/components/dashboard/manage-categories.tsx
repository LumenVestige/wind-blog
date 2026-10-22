'use client'
import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RequestError } from '@/components/ui/request-error'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  AdminStatus,
  useAdminQuery,
} from './admin-ui'
import { api } from '@/lib/api-client'
interface Category {
  id: number
  name: string
  isDefault: boolean
  articleCount: number
}
export function ManageCategories({ username }: { username: string }) {
  const query = useAdminQuery<{ list: Category[] }>(
    '/api/user/blog/category/mine',
  )
  const [editing, setEditing] = useState<{ id?: number; name: string } | null>(
      null,
    ),
    [name, setName] = useState('')
  const [target, setTarget] = useState<Category | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null)
  function edit(item?: Category) {
    setEditing(item || { name: '' })
    setName(item?.name || '')
    setError(null)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post(
        `/api/user/blog/category/${editing?.id ? 'update' : 'create'}`,
        { id: editing?.id, name: name.trim() },
      )
      setEditing(null)
      await query.refresh()
      toast.success('分类已保存')
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AdminHeading
        title="分类"
        description="为文章建立清晰的内容分组。"
        actions={
          <Button onClick={() => edit()}>
            <Plus data-icon="inline-start" />
            新建分类
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
          ) : !query.data?.list.length ? (
            <AdminEmpty
              title="还没有分类"
              action={
                <Button variant="outline" onClick={() => edit()}>
                  新建分类
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>文章数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.list.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-4">
                      <span className="mr-2 font-medium">{item.name}</span>
                      {item.isDefault && <AdminStatus>默认分类</AdminStatus>}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {item.articleCount || 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => edit(item)}
                        >
                          <Pencil data-icon="inline-start" />
                          重命名
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={item.isDefault}
                          aria-label={`删除分类：${item.name}`}
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
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? '重命名分类' : '新建分类'}</DialogTitle>
            <DialogDescription>用简洁的名称概括这组文章。</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="category-name">分类名称</FieldLabel>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={64}
                  required
                  disabled={busy}
                  autoFocus
                />
              </Field>
              {error != null && <RequestError error={error} />}
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                取消
              </Button>
              <Button disabled={busy || !name.trim()}>
                {busy ? '保存中…' : '保存分类'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDelete
        title={target?.name || ''}
        open={!!target}
        onClose={() => setTarget(null)}
        description="该分类下的文章将移入默认分类，文章内容会保留。"
        onConfirm={async () => {
          await api.post('/api/user/blog/category/delete', { id: target!.id })
          await query.refresh()
          toast.success('分类已删除')
        }}
      />
    </>
  )
}
