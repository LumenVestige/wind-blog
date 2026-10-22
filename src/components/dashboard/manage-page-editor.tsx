'use client'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useLocalDraft, useUnsavedChanges } from '@/lib/use-draft'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RequestError } from '@/components/ui/request-error'
import { AdminHeading } from './admin-ui'
import type { PageItem } from './manage-pages'
const Markdown = dynamic(
  () => import('@/components/blog/markdown').then((module) => module.Markdown),
  { ssr: false },
)
const empty: PageItem = {
  id: 0,
  title: '',
  slug: '',
  contentMd: '',
  status: 'draft',
  showInNav: false,
  navLabel: '',
  navOrder: 0,
}
export function ManagePageEditor({
  initial = empty,
  username,
}: {
  initial?: PageItem
  username: string
}) {
  const [value, setValue] = useState(initial),
    [baseline, setBaseline] = useState(JSON.stringify(initial)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null)
  const router = useRouter(),
    dirty = JSON.stringify(value) !== baseline,
    markClean = useUnsavedChanges(dirty)
  const draft = useLocalDraft(
    `wind-page-draft:${username}:${initial.id || 'new'}`,
    value,
    dirty,
    true,
  )
  function change<K extends keyof PageItem>(key: K, next: PageItem[K]) {
    setValue((previous) => ({ ...previous, [key]: next }))
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post(
        `/api/user/blog/page/${initial.id ? 'update' : 'create'}`,
        value,
      )
      draft.clear()
      markClean()
      setBaseline(JSON.stringify(value))
      toast.success(value.status === 'draft' ? '页面草稿已保存' : '页面已发布')
      router.push('/manage/pages')
      router.refresh()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AdminHeading
        title={initial.id ? '编辑页面' : '新建页面'}
        description="编写独立于文章列表的页面内容。"
        actions={
          <Button variant="outline" asChild>
            <Link href="/manage/pages">返回页面列表</Link>
          </Button>
        }
      />
      {draft.stored && (
        <Alert>
          <AlertTitle>发现未保存的本地草稿</AlertTitle>
          <AlertDescription>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setValue({
                    ...empty,
                    ...draft.stored!.value,
                    id: initial.id,
                  })
                  draft.discard()
                }}
              >
                恢复草稿
              </Button>
              <Button size="sm" variant="outline" onClick={draft.discard}>
                丢弃草稿
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={save}>
        <FieldSet disabled={busy}>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader>
                <CardTitle>页面内容</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="page-title">标题</FieldLabel>
                    <Input
                      id="page-title"
                      value={value.title}
                      onChange={(event) => change('title', event.target.value)}
                      maxLength={200}
                      required
                    />
                  </Field>
                  <Tabs defaultValue="write">
                    <TabsList>
                      <TabsTrigger value="write">编辑</TabsTrigger>
                      <TabsTrigger value="preview">预览</TabsTrigger>
                    </TabsList>
                    <TabsContent value="write">
                      <Field>
                        <FieldLabel htmlFor="page-content" className="sr-only">
                          页面正文
                        </FieldLabel>
                        <Textarea
                          id="page-content"
                          value={value.contentMd}
                          onChange={(event) =>
                            change('contentMd', event.target.value)
                          }
                          className="min-h-[460px] font-mono"
                          placeholder="使用 Markdown 编写页面…"
                        />
                      </Field>
                    </TabsContent>
                    <TabsContent value="preview">
                      <div className="min-h-[460px]">
                        <Markdown source={value.contentMd} />
                      </div>
                    </TabsContent>
                  </Tabs>
                </FieldGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>发布设置</CardTitle>
                <CardDescription>
                  配置页面的访问路径与导航入口。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="page-slug">页面路径</FieldLabel>
                    <Input
                      id="page-slug"
                      value={value.slug}
                      onChange={(event) => change('slug', event.target.value)}
                      placeholder="留空自动生成"
                    />
                    <FieldDescription>
                      /p/{value.slug || '页面路径'}
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="page-status">发布状态</FieldLabel>
                    <Select
                      value={value.status}
                      onValueChange={(status) => change('status', status)}
                    >
                      <SelectTrigger id="page-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="draft">草稿</SelectItem>
                          <SelectItem value="published">公开发布</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="page-nav">显示在导航</FieldLabel>
                    </FieldContent>
                    <Switch
                      id="page-nav"
                      checked={value.showInNav}
                      onCheckedChange={(visible) =>
                        change('showInNav', visible)
                      }
                    />
                  </Field>
                  {value.showInNav && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="page-nav-label">
                          导航名称
                        </FieldLabel>
                        <Input
                          id="page-nav-label"
                          value={value.navLabel}
                          onChange={(event) =>
                            change('navLabel', event.target.value)
                          }
                          placeholder="留空使用页面标题"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="page-order">导航顺序</FieldLabel>
                        <Input
                          id="page-order"
                          type="number"
                          value={value.navOrder}
                          onChange={(event) =>
                            change('navOrder', Number(event.target.value))
                          }
                        />
                        <FieldDescription>
                          数值较小的显示在前。
                        </FieldDescription>
                      </Field>
                    </>
                  )}
                  {error != null && <RequestError error={error} />}
                </FieldGroup>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-3">
                <ActionButton type="submit" pending={busy}>
                  {busy
                    ? '保存中…'
                    : value.status === 'draft'
                      ? '保存草稿'
                      : '保存并发布'}
                </ActionButton>
                <p
                  className="text-center text-xs text-muted-foreground"
                  role="status"
                >
                  {draft.status ||
                    (dirty
                      ? '有未保存的修改'
                      : initial.id
                        ? '所有修改已保存'
                        : '尚未创建页面')}
                </p>
              </CardFooter>
            </Card>
          </div>
        </FieldSet>
      </form>
    </>
  )
}
