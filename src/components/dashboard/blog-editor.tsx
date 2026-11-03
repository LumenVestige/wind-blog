'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus } from 'lucide-react'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AdminEmpty, AdminHeading, AdminLoading } from './admin-ui'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RequestError } from '@/components/ui/request-error'
import { api, ClientApiError } from '@/lib/api-client'
import { useLocalDraft, useUnsavedChanges } from '@/lib/use-draft'
import dynamic from 'next/dynamic'
const Markdown = dynamic(
  () => import('@/components/blog/markdown').then((m) => m.Markdown),
  { ssr: false },
)
const empty = {
  title: '',
  slug: '',
  content: '',
  summary: '',
  autoSummary: true,
  tags: '',
  categoryId: '',
  visibility: 'public',
  coverUrl: '',
}
type Draft = typeof empty
type Article = {
  id: number
  title: string
  slug: string
  content?: string
  summary: string
  summaryIsDefault: boolean
  isDraft: boolean
  tags: string[]
  categoryId: number | null
  visibility: string
  coverUrl?: string
}
export function BlogEditor({
  articleId,
  username,
  returnTo = 'list',
  initialTitle = '',
  initialVisibility = 'public',
}: {
  articleId?: number
  username: string
  /** Return to the screen that started this editing task. */
  returnTo?: 'article' | 'list' | 'content'
  initialTitle?: string
  initialVisibility?: 'public' | 'unlisted'
}) {
  const [value, setValue] = useState<Draft>(() => ({ ...empty, title: initialTitle, visibility: initialVisibility }))
  const [baseline, setBaseline] = useState(() => JSON.stringify({ ...empty, title: initialTitle, visibility: initialVisibility }))
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  )
  const [configured, setConfigured] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null)
  const [loaded, setLoaded] = useState(false)
  const [isDraft, setIsDraft] = useState(!articleId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const dirty = JSON.stringify(value) !== baseline || !!password
  const markClean = useUnsavedChanges(dirty)
  const draft = useLocalDraft(
    `wind-draft:${username}:${articleId || 'new'}`,
    value,
    dirty,
    !loading && !error,
  )
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cats, cdn, article] = await Promise.all([
        api.get<{ list: { id: number; name: string }[] }>(
          '/api/user/blog/category/mine',
        ),
        api.get<{ configured: boolean }>('/api/user/blog/upyun'),
        articleId
          ? api.get<Article>('/api/user/blog/article/get', { id: articleId })
          : Promise.resolve(null),
      ])
      setCategories(cats.list)
      setConfigured(cdn.configured)
      setLoaded(true)
      if (article) {
        const next = {
          title: article.title,
          slug: article.slug,
          content: article.content || '',
          summary: article.summary,
          autoSummary: article.summaryIsDefault,
          tags: article.tags.join(', '),
          categoryId: article.categoryId ? String(article.categoryId) : '',
          visibility: article.isDraft ? 'public' : article.visibility,
          coverUrl: article.coverUrl || '',
        }
        setValue(next)
        setBaseline(JSON.stringify(next))
        setIsDraft(article.isDraft)
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [articleId])
  useEffect(() => {
    void load()
  }, [load])
  function update<K extends keyof Draft>(key: K, next: Draft[K]) {
    setValue((v) => ({ ...v, [key]: next }))
  }
  async function uploadImage(file: File) {
    const position = textareaRef.current?.selectionStart
    const before = value.content
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('purpose', 'blog')
      const res = await api.upload<{ url: string }>('/api/user/upload', form)
      const snippet = `\n![${file.name}](${res.url})\n`
      setValue((v) => {
        const at =
          v.content === before && position !== undefined
            ? position
            : v.content.length
        return {
          ...v,
          content: v.content.slice(0, at) + snippet + v.content.slice(at),
        }
      })
      toast.success('图片已上传')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }
  async function save(asDraft = false) {
    if (!value.title.trim()) {
      toast.error('请填写标题')
      return
    }
    if (
      !asDraft &&
      value.visibility === 'password' &&
      !password &&
      (!articleId || isDraft)
    ) {
      toast.error('请设置访问密码')
      return
    }
    setSaving(true)
    try {
      const saved = await api.post<{ slug: string }>(
        `/api/user/blog/article/${articleId ? 'update' : 'create'}`,
        {
          id: articleId,
          title: value.title,
          slug: value.slug,
          content: value.content,
          summary: value.autoSummary ? undefined : value.summary,
          autoSummary: value.autoSummary,
          tags: value.tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          categoryId: value.categoryId ? Number(value.categoryId) : null,
          visibility: asDraft ? 'private' : value.visibility,
          isDraft: asDraft,
          password:
            !asDraft && value.visibility === 'password'
              ? password || undefined
              : undefined,
          clearPassword: asDraft || value.visibility !== 'password',
          coverUrl: value.coverUrl,
        },
      )
      draft.clear()
      markClean()
      setBaseline(JSON.stringify(value))
      setPassword('')
      toast.success(
        asDraft
          ? '草稿已保存，访客不可见'
          : articleId && !isDraft
            ? '已更新'
            : '已发布',
      )
      // Keep navigation-page authoring inside its settings workflow.
      router.push(
        returnTo === 'article' && saved?.slug
          ? `/${encodeURIComponent(saved.slug)}`
          : returnTo === 'content' ? '/manage/settings/content' : '/manage/articles',
      )
      router.refresh()
    } catch (e) {
      setError(e)
      toast.error(e instanceof ClientApiError ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <AdminLoading />
  if (error && !loaded)
    return <RequestError error={error} retry={() => void load()} />
  return (
    <>
      <AdminHeading
        title={articleId ? (isDraft ? '编辑草稿' : '编辑文章') : '写文章'}
        description={
          draft.status ||
          (dirty ? '有未保存的修改' : '专注内容，发布设置在右侧。')
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/manage/articles">返回文章列表</Link>
            </Button>
            {(!articleId || isDraft) && (
              <Button
                variant="secondary"
                disabled={saving || uploading}
                onClick={() => void save(true)}
              >
                保存草稿
              </Button>
            )}
            <ActionButton
              pending={saving}
              disabled={uploading}
              onClick={() => void save()}
            >
              {saving
                ? '保存中…'
                : articleId && !isDraft
                  ? '更新文章'
                  : '发布文章'}
            </ActionButton>
          </>
        }
      />
      {error != null && <RequestError error={error} />}
      {draft.stored && (
        <Alert>
          <AlertTitle>发现未保存的本地草稿</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap items-center gap-3">
              <span>{new Date(draft.stored.savedAt).toLocaleString()}</span>
              <Button
                size="sm"
                onClick={() => {
                  setValue({ ...empty, ...draft.stored!.value })
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
      <FieldSet disabled={saving}>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>文章内容</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="article-title">标题</FieldLabel>
                    <Input
                      id="article-title"
                      placeholder="为文章起个标题"
                      value={value.title}
                      maxLength={200}
                      onChange={(event) => update('title', event.target.value)}
                    />
                  </Field>
                  <Tabs defaultValue="write">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <TabsList>
                        <TabsTrigger value="write">编辑</TabsTrigger>
                        <TabsTrigger value="preview">预览</TabsTrigger>
                      </TabsList>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!configured || uploading || saving}
                        onClick={() =>
                          document.getElementById('blog-image-input')?.click()
                        }
                      >
                        <ImagePlus data-icon="inline-start" />
                        {uploading ? '上传中…' : '插入图片'}
                      </Button>
                      <input
                        id="blog-image-input"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                        className="hidden"
                        onChange={(event) => {
                          if (event.target.files?.[0])
                            void uploadImage(event.target.files[0])
                          event.target.value = ''
                        }}
                      />
                    </div>
                    <TabsContent value="write">
                      <Field>
                        <FieldLabel
                          htmlFor="article-content"
                          className="sr-only"
                        >
                          文章正文
                        </FieldLabel>
                        <Textarea
                          id="article-content"
                          ref={textareaRef}
                          value={value.content}
                          onChange={(event) =>
                            update('content', event.target.value)
                          }
                          className="min-h-[520px] font-mono text-sm"
                          placeholder="使用 Markdown 写作…"
                        />
                      </Field>
                    </TabsContent>
                    <TabsContent value="preview">
                      <div className="min-h-[520px]">
                        {value.content ? (
                          <Markdown source={value.content} />
                        ) : (
                          <AdminEmpty
                            title="文章预览"
                            description="写下正文后可在这里查看排版。"
                          />
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  {!configured && (
                    <FieldDescription>
                      需要插入本地图片？先
                      <Link
                        className="underline"
                        href="/manage/settings/storage"
                      >
                        配置存储与上传
                      </Link>
                      。
                    </FieldDescription>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>文章摘要</CardTitle>
                <CardDescription>用于首页列表与分享预览。</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="auto-summary">
                        自动生成摘要
                      </FieldLabel>
                    </FieldContent>
                    <Switch
                      id="auto-summary"
                      checked={value.autoSummary}
                      onCheckedChange={(checked) =>
                        update('autoSummary', checked)
                      }
                    />
                  </Field>
                  {!value.autoSummary && (
                    <Field>
                      <FieldLabel htmlFor="article-summary">
                        手工摘要
                      </FieldLabel>
                      <Textarea
                        id="article-summary"
                        value={value.summary}
                        maxLength={200}
                        onChange={(event) =>
                          update('summary', event.target.value)
                        }
                      />
                    </Field>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>
          </div>
          <aside className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>发布设置</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="article-visibility">可见性</FieldLabel>
                    <Select
                      value={value.visibility}
                      onValueChange={(visibility) =>
                        update('visibility', visibility)
                      }
                    >
                      <SelectTrigger id="article-visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="public">公开</SelectItem>
                          <SelectItem value="unlisted">仅链接可见</SelectItem>
                          <SelectItem value="password">密码保护</SelectItem>
                          <SelectItem value="private">私密</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {value.visibility === 'unlisted' && <FieldDescription>不进入首页、归档、搜索等列表，知道链接的访客可以阅读。关联关于或友链的文章会保持此可见性。</FieldDescription>}
                  </Field>
                  {value.visibility === 'password' && (
                    <Field>
                      <FieldLabel htmlFor="article-password">
                        访问密码
                      </FieldLabel>
                      <Input
                        id="article-password"
                        type="password"
                        value={password}
                        autoComplete="new-password"
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={
                          articleId && !isDraft
                            ? '留空保留原密码'
                            : '设置访问密码'
                        }
                      />
                    </Field>
                  )}
                  <Field>
                    <FieldLabel htmlFor="article-category">分类</FieldLabel>
                    <Select
                      value={value.categoryId || 'default'}
                      onValueChange={(category) =>
                        update(
                          'categoryId',
                          category === 'default' ? '' : category,
                        )
                      }
                    >
                      <SelectTrigger id="article-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="default">默认分类</SelectItem>
                          {categories
                            .filter((category) => category.name !== '默认')
                            .map((category) => (
                              <SelectItem
                                key={category.id}
                                value={String(category.id)}
                              >
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="article-tags">标签</FieldLabel>
                    <Input
                      id="article-tags"
                      value={value.tags}
                      onChange={(event) => update('tags', event.target.value)}
                      placeholder="用逗号分隔"
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>链接与封面</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="article-slug">自定义路径</FieldLabel>
                    <Input
                      id="article-slug"
                      value={value.slug}
                      onChange={(event) => update('slug', event.target.value)}
                      placeholder="留空自动生成"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="article-cover">
                      封面图片地址
                    </FieldLabel>
                    <Input
                      id="article-cover"
                      value={value.coverUrl}
                      onChange={(event) =>
                        update('coverUrl', event.target.value)
                      }
                      placeholder="https://…"
                    />
                    {value.coverUrl && (
                      <>
                        <img
                          src={value.coverUrl}
                          alt="封面预览"
                          className="max-h-36 w-full rounded-md object-cover"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => update('coverUrl', '')}
                        >
                          移除封面
                        </Button>
                      </>
                    )}
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </aside>
        </div>
      </FieldSet>
    </>
  )
}
