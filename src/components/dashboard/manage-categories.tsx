'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface Category {
  id: number
  name: string
  isDefault: boolean
  articleCount: number
}

export function ManageCategories({ username }: { username: string }) {
  const [list, setList] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: number; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ list: Category[] }>('/api/user/blog/category/mine')
      setList(res.list || [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      await api.post('/api/user/blog/category/create', { name: name.trim() })
      setName('')
      toast.success('已添加分类')
      await load()
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : '添加失败')
    } finally {
      setCreating(false)
    }
  }

  async function confirmRename() {
    if (!renameTarget || !renameValue.trim()) return
    setRenaming(true)
    try {
      await api.post('/api/user/blog/category/update', { id: renameTarget.id, name: renameValue.trim() })
      toast.success('已保存')
      setRenameTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '保存失败')
    } finally {
      setRenaming(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.post('/api/user/blog/category/delete', { id: deleteTarget.id })
      toast.success('已删除')
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">分类</h1>
        <p className="text-sm text-muted-foreground">文章归类，默认分类不能删除</p>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-md gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新分类名称" />
        <Button type="submit" disabled={creating} className="gap-1.5">
          <Plus className="size-4" />
          添加
        </Button>
      </form>

      {error ? <RequestError error={error} retry={() => void load()} /> : loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">加载中…</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">还没有分类</div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.isDefault ? <span className="text-xs text-muted-foreground">默认</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.articleCount ?? 0} 篇{c.isDefault ? ' · 删不掉' : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRenameTarget({ id: c.id, name: c.name })
                    setRenameValue(c.name)
                  }}
                >
                  <Pencil className="size-3.5" />
                  编辑
                </Button>
                {!c.isDefault ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget({ id: c.id, name: c.name })}>
                    <Trash2 className="size-3.5" />
                    删除
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" asChild>
        <Link href={`/manage`}>返回管理</Link>
      </Button>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && !renaming && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改分类名称</DialogTitle>
            <DialogDescription>当前：{renameTarget?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-cat">新名称</Label>
            <Input
              id="rename-cat"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmRename()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={renaming} onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button disabled={renaming} onClick={() => void confirmRename()}>
              {renaming ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除分类？</DialogTitle>
            <DialogDescription>
              删除分类「{deleteTarget?.name}」？该分类下的文章将移入默认分类。
            </DialogDescription>
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
