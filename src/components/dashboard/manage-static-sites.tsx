'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import {
  Upload,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useUnsavedChanges } from '@/lib/use-draft'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { RequestError } from '@/components/ui/request-error'
import {
  AdminEmpty,
  AdminHeading,
  AdminLoading,
  AdminStatus,
  useAdminQuery,
} from './admin-ui'
interface StaticSite {
  id: number
  title: string
  slug: string
  fileCount: number
  showInNav: boolean
  publicPath: string
  navLabel: string
  navOrder: number
}
export function ManageStaticSites({ configured }: { configured: boolean }) {
  const query = useAdminQuery<StaticSite[]>('/api/user/blog/static-site/mine')
  const [upload, setUpload] = useState<{
      id?: number
      title: string
      slug: string
    } | null>(null),
    [file, setFile] = useState<File | null>(null)
  const [editing, setEditing] = useState<StaticSite | null>(null),
    [original, setOriginal] = useState(''),
    [target, setTarget] = useState<StaticSite | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null)
  const editDirty = !!editing && JSON.stringify(editing) !== original,
    uploadDirty =
      !!file || (!!upload && !upload.id && (!!upload.title || !!upload.slug))
  useUnsavedChanges(editDirty || uploadDirty)
  function openUpload(site?: StaticSite) {
    setUpload(
      site
        ? { id: site.id, title: site.title, slug: site.slug }
        : { title: '', slug: '' },
    )
    setFile(null)
    setError(null)
  }
  function closeUpload() {
    if (!busy && (!uploadDirty || window.confirm('放弃本次未提交的上传？'))) {
      setUpload(null)
      setFile(null)
    }
  }
  function closeEditor() {
    if (!busy && (!editDirty || window.confirm('放弃未保存的站点设置？')))
      setEditing(null)
  }
  async function publish(event: FormEvent) {
    event.preventDefault()
    if (!upload || !file) return
    if (file.size > 32 * 1024 * 1024) {
      setError(new Error('ZIP 文件不能超过 32MB'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', upload.title)
      if (upload.slug) form.append('slug', upload.slug)
      if (upload.id) form.append('id', String(upload.id))
      else form.append('showInNav', 'true')
      await api.upload('/api/user/blog/static-site/upload', form)
      setUpload(null)
      setFile(null)
      await query.refresh()
      toast.success('静态站点已发布')
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      await api.post('/api/user/blog/static-site/update', editing)
      setEditing(null)
      await query.refresh()
      toast.success('站点设置已保存')
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AdminHeading
        title="静态站点"
        description="上传 ZIP，发布完整的静态网页或小型站点。"
        actions={
          <Button disabled={!configured} onClick={() => openUpload()}>
            <Upload data-icon="inline-start" />
            上传站点
          </Button>
        }
      />
      {!configured && (
        <Alert>
          <AlertDescription>
            上传站点前，请先
            <Link className="underline" href="/manage/settings/storage">
              配置存储与上传
            </Link>
            。
          </AlertDescription>
        </Alert>
      )}
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
              title="还没有静态站点"
              description="将包含 index.html 的文件打包为 ZIP 后上传。"
              action={
                <Button
                  variant="outline"
                  disabled={!configured}
                  onClick={() => openUpload()}
                >
                  上传站点
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>站点</TableHead>
                  <TableHead>文件数</TableHead>
                  <TableHead>展示状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="py-4">
                      <span className="font-medium">{site.title}</span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {site.slug}
                      </p>
                    </TableCell>
                    <TableCell>{site.fileCount}</TableCell>
                    <TableCell>
                      <AdminStatus
                        tone={site.showInNav ? 'success' : 'neutral'}
                      >
                        {site.showInNav ? '博客中展示' : '不展示'}
                      </AdminStatus>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={site.publicPath}
                            target="_blank"
                            rel="noreferrer"
                          >
                            访问
                            <ExternalLink data-icon="inline-end" />
                          </a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`更多操作：${site.title}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditing(site)
                                  setOriginal(JSON.stringify(site))
                                  setError(null)
                                }}
                              >
                                <Pencil />
                                站点设置
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!configured}
                                onSelect={() => openUpload(site)}
                              >
                                <Upload />
                                更新 ZIP
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => setTarget(site)}
                              >
                                <Trash2 />
                                删除站点
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
        </CardContent>
      </Card>
      <Sheet
        open={!!upload}
        onOpenChange={(open) => {
          if (!open) closeUpload()
        }}
      >
        <SheetContent className="overflow-y-auto p-6 sm:max-w-lg">
          <SheetHeader className="p-0">
            <SheetTitle>
              {upload?.id ? '更新静态站点' : '上传静态站点'}
            </SheetTitle>
            <SheetDescription>
              支持 ZIP，最大 32MB。入口文件为 index.html。
            </SheetDescription>
          </SheetHeader>
          {upload && (
            <form onSubmit={publish} className="mt-6 flex flex-col gap-6">
              <FieldSet disabled={busy}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="zip-title">站点标题</FieldLabel>
                    <Input
                      id="zip-title"
                      value={upload.title}
                      required
                      maxLength={200}
                      onChange={(event) =>
                        setUpload({ ...upload, title: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="zip-slug">站点路径</FieldLabel>
                    <Input
                      id="zip-slug"
                      value={upload.slug}
                      readOnly={!!upload.id}
                      placeholder="留空自动生成"
                      onChange={(event) =>
                        setUpload({ ...upload, slug: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="zip-file">ZIP 文件</FieldLabel>
                    <Input
                      id="zip-file"
                      type="file"
                      accept=".zip,application/zip"
                      required
                      onChange={(event) =>
                        setFile(event.target.files?.[0] || null)
                      }
                    />
                    {file && (
                      <FieldDescription>
                        {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>
              </FieldSet>
              {error != null && <RequestError error={error} />}
              <SheetFooter className="p-0">
                <Button disabled={busy || !file || !upload.title.trim()}>
                  {busy ? '发布中…' : upload.id ? '更新并发布' : '上传并发布'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={closeUpload}
                >
                  取消
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>站点设置</DialogTitle>
            <DialogDescription>调整标题与博客展示方式。</DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="flex flex-col gap-5">
              <FieldSet disabled={busy}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="static-title">标题</FieldLabel>
                    <Input
                      id="static-title"
                      value={editing.title}
                      required
                      maxLength={200}
                      onChange={(event) =>
                        setEditing({ ...editing, title: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="static-label">展示名称</FieldLabel>
                    <Input
                      id="static-label"
                      value={editing.navLabel}
                      onChange={(event) =>
                        setEditing({ ...editing, navLabel: event.target.value })
                      }
                      placeholder="留空使用标题"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="static-order">展示顺序</FieldLabel>
                    <Input
                      id="static-order"
                      type="number"
                      value={editing.navOrder}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          navOrder: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="static-nav">在博客中展示</FieldLabel>
                    </FieldContent>
                    <Switch
                      id="static-nav"
                      checked={editing.showInNav}
                      onCheckedChange={(showInNav) =>
                        setEditing({ ...editing, showInNav })
                      }
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
              {error != null && <RequestError error={error} />}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={closeEditor}
                >
                  取消
                </Button>
                <Button disabled={busy || !editDirty}>
                  {busy ? '保存中…' : '保存设置'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDelete
        open={!!target}
        title={target?.title || ''}
        onClose={() => setTarget(null)}
        onConfirm={async () => {
          await api.post('/api/user/blog/static-site/delete', {
            id: target!.id,
          })
          await query.refresh()
          toast.success('站点已删除')
        }}
      />
    </>
  )
}
