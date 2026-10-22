'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { RequestError } from '@/components/ui/request-error'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
import { api } from '@/lib/api-client'
import { useUnsavedChanges } from '@/lib/use-draft'
import dynamic from 'next/dynamic'
const Markdown = dynamic(() => import('@/components/blog/markdown').then(m => m.Markdown), { ssr: false })
type PageItem = { id: number; title: string; slug: string; contentMd: string; status: string; showInNav: boolean; navLabel: string; navOrder: number }
type StaticSite = { id: number; title: string; slug: string; fileCount: number; showInNav: boolean; publicPath: string; navLabel: string; navOrder: number }
const empty = { id: 0, title: '', slug: '', contentMd: '', status: 'draft', showInNav: false, navLabel: '', navOrder: 0 }
export function ManageStatic() {
  const [pages, setPages] = useState<PageItem[]>([]), [sites, setSites] = useState<StaticSite[]>([])
  const [form, setForm] = useState(empty), [baseline, setBaseline] = useState(JSON.stringify(empty)), [preview, setPreview] = useState(false)
  const [zipTitle, setZipTitle] = useState(''), [zipSlug, setZipSlug] = useState(''), [replaceId, setReplaceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false), [configured, setConfigured] = useState(false)
  const [target, setTarget] = useState<{ id: number; title: string; kind: 'page' | 'static-site' } | null>(null)
  const [siteBase, setSiteBase] = useState('')
  const dirty = JSON.stringify(form) !== baseline
  useUnsavedChanges(dirty || !!siteBase && JSON.stringify(sites) !== siteBase || !!zipTitle || !!zipSlug)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const [p, s, cdn] = await Promise.all([api.get<PageItem[]>('/api/user/blog/page/mine'), api.get<StaticSite[]>('/api/user/blog/static-site/mine'), api.get<{ configured: boolean }>('/api/user/blog/upyun')]); setPages(p); setSites(s); setSiteBase(JSON.stringify(s)); setConfigured(cdn.configured) }
    catch (e) { setError(e) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  function selectPage(next = empty) { if (dirty && !confirm('当前页面还有未保存的修改，确定切换吗？')) return; setForm(next); setBaseline(JSON.stringify(next)); setPreview(false); document.getElementById('page-editor')?.scrollIntoView({ behavior: 'smooth' }) }
  async function savePage() {
    setBusy(true)
    try { const saved = await api.post<PageItem>(`/api/user/blog/page/${form.id ? 'update' : 'create'}`, form); const next = { ...empty, ...saved }; setForm(next); setBaseline(JSON.stringify(next)); toast.success(saved.status === 'draft' ? '页面草稿已保存' : '页面已发布'); setPages(old => [...old.filter(p => p.id !== saved.id), saved].sort((a, b) => a.navOrder - b.navOrder || a.id - b.id)) }
    catch (e) { toast.error(e instanceof Error ? e.message : '保存失败') } finally { setBusy(false) }
  }
  async function uploadZip(file: File) {
    if (!zipTitle.trim()) { toast.error('请先填写静态站点标题'); return }
    setBusy(true)
    try { const data = new FormData(); data.append('file', file); data.append('title', zipTitle); if (zipSlug) data.append('slug', zipSlug); if (replaceId) data.append('id', String(replaceId)); else data.append('showInNav', 'true'); const saved = await api.upload<StaticSite>('/api/user/blog/static-site/upload', data); setSites(old => [...old.filter(s => s.id !== saved.id), saved]); setSiteBase(old => JSON.stringify([...(JSON.parse(old || '[]') as StaticSite[]).filter(s => s.id !== saved.id), saved])); setZipTitle(''); setZipSlug(''); setReplaceId(null); toast.success('静态站点已发布') }
    catch (e) { toast.error(e instanceof Error ? e.message : '上传失败') } finally { setBusy(false) }
  }
  return <div className="space-y-8"><h1 className="text-xl font-semibold">页面管理</h1>{error != null && <RequestError error={error} retry={() => void load()} />}
    <section id="page-editor" className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-medium">{form.id ? '编辑自定义页面' : '新建自定义页面'}</h2>{form.id > 0 && <Button variant="outline" onClick={() => selectPage()}>新建页面</Button>}</div>
      <form className="rounded-xl border bg-card p-4" onSubmit={e => { e.preventDefault(); void savePage() }}><fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="page-title">标题</Label><Input id="page-title" value={form.title} required maxLength={200} onChange={e => setForm({ ...form, title: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="page-slug">路径（留空自动生成）</Label><Input id="page-slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div></div>
        <div className="flex gap-2"><Button type="button" variant={preview ? 'outline' : 'secondary'} onClick={() => setPreview(false)}>编辑</Button><Button type="button" variant={preview ? 'secondary' : 'outline'} onClick={() => setPreview(true)}>预览</Button></div>
        {preview ? <div className="min-h-48 rounded border p-4"><Markdown source={form.contentMd} /></div> : <><Label htmlFor="page-content">Markdown 正文</Label><Textarea id="page-content" value={form.contentMd} className="min-h-60 font-mono" onChange={e => setForm({ ...form, contentMd: e.target.value })} /></>}
        <div className="flex flex-wrap items-center gap-4"><Label htmlFor="page-status">状态</Label><select id="page-status" className="rounded border bg-background p-2" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="draft">草稿</option><option value="published">公开发布</option></select><Switch id="page-nav" checked={form.showInNav} onCheckedChange={v => setForm({ ...form, showInNav: v })} /><Label htmlFor="page-nav">显示在导航</Label></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="page-nav-label">导航名称（留空使用标题）</Label><Input id="page-nav-label" value={form.navLabel} onChange={e => setForm({ ...form, navLabel: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="page-nav-order">导航顺序（小的在前）</Label><Input id="page-nav-order" type="number" value={form.navOrder} onChange={e => setForm({ ...form, navOrder: Number(e.target.value) || 0 })} /></div></div>
        <div className="flex gap-2"><Button type="submit">{busy ? '保存中…' : form.status === 'draft' ? '保存草稿' : '保存并发布'}</Button>{form.id > 0 && <Button variant="outline" asChild><Link href={`/p/${form.slug}`} target="_blank">{form.status === 'draft' ? '打开草稿预览' : '查看页面'}</Link></Button>}</div>
      </fieldset></form>
      {loading ? <p>加载页面中…</p> : !error && !pages.length ? <p>还没有自定义页面。</p> : <ul className="divide-y rounded-lg border">{pages.map(p => <li key={p.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-medium">{p.title}</p><p className="text-xs text-muted-foreground">/p/{p.slug}</p></div><Badge variant="secondary">{p.status === 'draft' ? '草稿' : '已发布'}</Badge>{p.showInNav && <Badge variant="outline">导航</Badge>}<Button variant="outline" disabled={busy} onClick={() => selectPage({ ...empty, ...p })}>编辑</Button><Button variant="outline" asChild><Link target="_blank" href={`/p/${p.slug}`}>查看</Link></Button><Button variant="ghost" disabled={busy} onClick={() => setTarget({ id: p.id, title: p.title, kind: 'page' })}>删除</Button></li>)}</ul>}
    </section>
    <section className="space-y-4"><h2 className="font-medium">静态站点</h2><p className="text-sm text-muted-foreground">上传 ZIP（最大 32MB），保留原来的资源目录结构。文件发布到图床。</p>{!configured && <p className="text-sm"><Link className="text-primary underline" href="/manage/settings#cdn">先配置又拍云 CDN 后即可上传</Link></p>}
      <div className="flex flex-wrap items-end gap-3"><div><Label htmlFor="zip-title">标题</Label><Input id="zip-title" value={zipTitle} onChange={e => setZipTitle(e.target.value)} /></div><div><Label htmlFor="zip-slug">路径（可选）</Label><Input id="zip-slug" value={zipSlug} onChange={e => setZipSlug(e.target.value)} /></div><label className="inline-flex cursor-pointer rounded-md border px-4 py-2 text-sm">{busy ? '上传中…' : replaceId ? '选择 ZIP 更新站点' : '选择 ZIP 发布'}<input type="file" disabled={!configured || busy} className="sr-only" accept=".zip,application/zip" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadZip(f) }} /></label>{replaceId && <Button variant="ghost" onClick={() => { setReplaceId(null); setZipTitle(''); setZipSlug('') }}>取消更新</Button>}</div>
      {!loading && !error && !sites.length && <p>还没有静态站点。</p>}
      {sites.map((s, index) => <article key={s.id} className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap gap-3"><Input aria-label={`${s.slug} 标题`} className="max-w-xs" value={s.title} onChange={e => setSites(old => old.map((v, i) => i === index ? { ...v, title: e.target.value } : v))} /><Input aria-label={`${s.slug} 导航名称`} placeholder="导航名称" className="max-w-xs" value={s.navLabel} onChange={e => setSites(old => old.map((v, i) => i === index ? { ...v, navLabel: e.target.value } : v))} /><Input aria-label={`${s.slug} 导航顺序`} className="w-24" type="number" value={s.navOrder} onChange={e => setSites(old => old.map((v, i) => i === index ? { ...v, navOrder: Number(e.target.value) || 0 } : v))} /></div><div className="flex flex-wrap items-center gap-3"><Switch aria-label={`${s.slug} 显示在导航`} checked={s.showInNav} onCheckedChange={v => setSites(old => old.map((item, i) => i === index ? { ...item, showInNav: v } : item))} /><span className="text-sm">显示在导航 · {s.fileCount} 个文件</span><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const saved = await api.post<StaticSite>('/api/user/blog/static-site/update', s); setSites(old => old.map(item => item.id === saved.id ? saved : item)); setSiteBase(old => JSON.stringify((JSON.parse(old || '[]') as StaticSite[]).map(item => item.id === saved.id ? saved : item))); toast.success('静态站点设置已保存') } catch (e) { toast.error(e instanceof Error ? e.message : '保存失败') } finally { setBusy(false) } }}>保存设置</Button><Button variant="outline" asChild><a href={s.publicPath} target="_blank" rel="noreferrer">查看</a></Button><Button variant="outline" onClick={() => { setReplaceId(s.id); setZipTitle(s.title); setZipSlug(s.slug) }}>更新 ZIP</Button><Button variant="ghost" disabled={busy} onClick={() => setTarget({ id: s.id, title: s.title, kind: 'static-site' })}>删除</Button></div></article>)}
    </section><ConfirmDelete title={target?.title || ''} open={!!target} onClose={() => setTarget(null)} onConfirm={async () => { try { await api.post(`/api/user/blog/${target!.kind}/delete`, { id: target!.id }); if (target!.kind === 'page' && target!.id === form.id) { setForm(empty); setBaseline(JSON.stringify(empty)) } if (target!.kind === 'page') setPages(old => old.filter(p => p.id !== target!.id)); else { setSites(old => old.filter(s => s.id !== target!.id)); setSiteBase(old => JSON.stringify((JSON.parse(old || '[]') as StaticSite[]).filter(s => s.id !== target!.id))) }; toast.success('已删除') } catch (e) { toast.error(e instanceof Error ? e.message : '删除失败') } }} />
  </div>
}
