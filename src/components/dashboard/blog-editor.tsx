'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImagePlus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RequestError } from '@/components/ui/request-error'
import { api, ClientApiError } from '@/lib/api-client'
import { useLocalDraft, useUnsavedChanges } from '@/lib/use-draft'
import dynamic from 'next/dynamic'
const Markdown = dynamic(() => import('@/components/blog/markdown').then(m => m.Markdown), { ssr: false })
const empty = { title: '', slug: '', content: '', summary: '', autoSummary: true, tags: '', categoryId: '', visibility: 'public', coverUrl: '' }
type Draft = typeof empty
type Article = { id: number; title: string; slug: string; content?: string; summary: string; summaryIsDefault: boolean; isDraft: boolean; tags: string[]; categoryId: number | null; visibility: string; coverUrl?: string }
export function BlogEditor({ articleId, username }: { articleId?: number; username: string }) {
  const [value, setValue] = useState<Draft>(empty)
  const [baseline, setBaseline] = useState(JSON.stringify(empty))
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [configured, setConfigured] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true), [error, setError] = useState<unknown>(null)
  const [loaded, setLoaded] = useState(false)
  const [isDraft, setIsDraft] = useState(!articleId)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const dirty = JSON.stringify(value) !== baseline || !!password
  const markClean = useUnsavedChanges(dirty)
  const draft = useLocalDraft(`wind-draft:${username}:${articleId || 'new'}`, value, dirty, !loading && !error)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cats, cdn, article] = await Promise.all([
        api.get<{ list: { id: number; name: string }[] }>('/api/user/blog/category/mine'),
        api.get<{ configured: boolean }>('/api/user/blog/upyun'),
        articleId ? api.get<Article>('/api/user/blog/article/get', { id: articleId }) : Promise.resolve(null),
      ])
      setCategories(cats.list); setConfigured(cdn.configured); setLoaded(true)
      if (article) {
        const next = { title: article.title, slug: article.slug, content: article.content || '', summary: article.summary,
          autoSummary: article.summaryIsDefault, tags: article.tags.join(', '), categoryId: article.categoryId ? String(article.categoryId) : '',
          visibility: article.isDraft ? 'public' : article.visibility, coverUrl: article.coverUrl || '' }
        setValue(next); setBaseline(JSON.stringify(next)); setIsDraft(article.isDraft)
      }
    } catch (e) { setError(e) } finally { setLoading(false) }
  }, [articleId])
  useEffect(() => { void load() }, [load])
  function update<K extends keyof Draft>(key: K, next: Draft[K]) { setValue(v => ({ ...v, [key]: next })) }
  async function uploadImage(file: File) {
    const position = textareaRef.current?.selectionStart
    const before = value.content
    setUploading(true)
    try {
      const form = new FormData(); form.append('file', file); form.append('purpose', 'blog')
      const res = await api.upload<{ url: string }>('/api/user/upload', form)
      const snippet = `\n![${file.name}](${res.url})\n`
      setValue(v => { const at = v.content === before && position !== undefined ? position : v.content.length; return { ...v, content: v.content.slice(0, at) + snippet + v.content.slice(at) } })
      toast.success('图片已上传')
    } catch (e) { toast.error(e instanceof Error ? e.message : '上传失败') } finally { setUploading(false) }
  }
  async function save(asDraft = false) {
    if (!value.title.trim()) { toast.error('请填写标题'); return }
    if (!asDraft && value.visibility === 'password' && !password && (!articleId || isDraft)) { toast.error('请设置访问密码'); return }
    setSaving(true)
    try {
      await api.post(`/api/user/blog/article/${articleId ? 'update' : 'create'}`, {
        id: articleId, title: value.title, slug: value.slug, content: value.content,
        summary: value.autoSummary ? undefined : value.summary, autoSummary: value.autoSummary,
        tags: value.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean), categoryId: value.categoryId ? Number(value.categoryId) : null,
        visibility: asDraft ? 'private' : value.visibility, isDraft: asDraft,
        password: !asDraft && value.visibility === 'password' ? password || undefined : undefined,
        clearPassword: asDraft || value.visibility !== 'password', coverUrl: value.coverUrl,
      })
      draft.clear(); markClean(); setBaseline(JSON.stringify(value)); setPassword('')
      toast.success(asDraft ? '草稿已保存，访客不可见' : articleId && !isDraft ? '已更新' : '已发布')
      router.push('/manage'); router.refresh()
    } catch (e) { setError(e); toast.error(e instanceof ClientApiError ? e.message : '保存失败') } finally { setSaving(false) }
  }
  if (loading) return <p role="status">加载中…</p>
  // Preserve the form on save failure; initial failures never expose an empty editable article.
  if (error && !loaded) return <RequestError error={error} retry={() => void load()} />
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">{articleId ? isDraft ? '编辑草稿' : '编辑文章' : '写文章'}</h1><p className="text-xs text-muted-foreground" role="status">{draft.status || (dirty ? '有未保存的修改' : '修改后自动保存本地草稿')}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/manage">返回列表</Link></Button>
        <Button variant="outline" disabled={!configured || uploading || saving} onClick={() => document.getElementById('blog-image-input')?.click()}><ImagePlus />{uploading ? '上传中…' : '上传图片'}</Button>
        <input id="blog-image-input" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon" className="hidden" onChange={e => { if (e.target.files?.[0]) void uploadImage(e.target.files[0]); e.target.value = '' }} />
        {(!articleId || isDraft) && <Button variant="secondary" disabled={saving || uploading} onClick={() => void save(true)}>保存草稿</Button>}
        <Button disabled={saving || uploading} onClick={() => void save()}><Save />{saving ? '保存中…' : articleId && !isDraft ? '更新文章' : '发布文章'}</Button>
      </div>
    </div>
    {error != null && <RequestError error={error} />}
    {draft.stored && <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><span>发现本地草稿（{new Date(draft.stored.savedAt).toLocaleString()}）</span><Button onClick={() => { setValue({ ...empty, ...draft.stored!.value }); draft.discard() }}>恢复草稿</Button><Button variant="outline" onClick={draft.discard}>放弃本地草稿</Button></div>}
    {!configured && <p className="text-sm text-muted-foreground">图片上传尚未配置，<Link className="text-primary underline" href="/manage/settings#cdn">前往配置图床</Link>。仍可使用已有图片 URL。</p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="space-y-4">
      <Label htmlFor="article-title">标题</Label><Input id="article-title" placeholder="标题" value={value.title} maxLength={200} onChange={e => update('title', e.target.value)} />
      <Tabs defaultValue="write"><TabsList><TabsTrigger value="write">编辑</TabsTrigger><TabsTrigger value="preview">预览</TabsTrigger></TabsList><TabsContent value="write"><Textarea aria-label="文章正文" ref={textareaRef} value={value.content} onChange={e => update('content', e.target.value)} className="min-h-[420px] font-mono text-sm" placeholder="使用 Markdown 写作…" /></TabsContent><TabsContent value="preview"><div className="min-h-[420px] rounded-md border p-4"><Markdown source={value.content} /></div></TabsContent></Tabs>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.autoSummary} onChange={e => update('autoSummary', e.target.checked)} />根据正文自动生成摘要</label>
      {!value.autoSummary && <><Label htmlFor="article-summary">手工摘要</Label><Textarea id="article-summary" value={value.summary} maxLength={200} onChange={e => update('summary', e.target.value)} /></>}
    </div><aside className="space-y-4">
      <div className="space-y-2"><Label>分类</Label><Select value={value.categoryId || 'default'} onValueChange={v => update('categoryId', v === 'default' ? '' : v)}><SelectTrigger aria-label="分类"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">默认分类</SelectItem>{categories.filter(c => c.name !== '默认').map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}{categories.filter(c => c.name === '默认').map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>发布可见性</Label><Select value={value.visibility} onValueChange={v => update('visibility', v)}><SelectTrigger aria-label="发布可见性"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">公开</SelectItem><SelectItem value="password">密码保护</SelectItem><SelectItem value="private">私密</SelectItem></SelectContent></Select></div>
      {value.visibility === 'password' && <div className="space-y-2"><Label htmlFor="article-password">访问密码</Label><Input id="article-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={articleId && !isDraft ? '留空保留原密码' : '设置访问密码'} /></div>}
      <div className="space-y-2"><Label htmlFor="article-tags">标签（逗号分隔）</Label><Input id="article-tags" value={value.tags} onChange={e => update('tags', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="article-slug">自定义路径</Label><Input id="article-slug" value={value.slug} onChange={e => update('slug', e.target.value)} placeholder="留空自动生成" /></div>
      <div className="space-y-2"><Label htmlFor="article-cover">封面图 URL</Label><Input id="article-cover" value={value.coverUrl} onChange={e => update('coverUrl', e.target.value)} />{value.coverUrl && <><img src={value.coverUrl} alt="封面预览" className="max-h-36 w-full rounded object-cover" /><Button variant="outline" onClick={() => update('coverUrl', '')}>移除封面</Button></>}</div>
    </aside></div>
  </div>
}
