'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { RequestError } from '@/components/ui/request-error'
import { ConfirmDelete } from '@/components/ui/confirm-delete'
type Item = { id: number; content: string; author: { name: string }; articleTitle: string; slug: string }
export function ManageComments() {
  const [list, setList] = useState<Item[]>([]), [error, setError] = useState<unknown>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [target, setTarget] = useState<Item | null>(null)
  const load = useCallback(async () => { setLoading(true); setError(null); try { const r = await api.get<{ list: Item[] }>('/api/user/blog/comment/pending'); setList(r.list) } catch (e) { setError(e) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  return <div className="space-y-4"><h1 className="text-xl font-semibold">留言审核</h1><p className="text-sm text-muted-foreground">访客留言审核通过后才会公开。已公开评论可在文章页管理。</p>{error != null && <RequestError error={error} retry={() => void load()} />}{loading ? <p>加载中…</p> : !error && !list.length ? <p>没有待审核留言。</p> : list.map(c => <article key={c.id} className="space-y-3 rounded-lg border p-4"><p className="font-medium">{c.author.name} · <Link href={`/${c.slug}`} className="text-primary">{c.articleTitle}</Link></p><p className="whitespace-pre-wrap break-words">{c.content}</p><div className="flex gap-2"><Button disabled={busy} onClick={async () => { setBusy(true); try { await api.post('/api/user/blog/comment/approve', { id: c.id }); await load(); toast.success('留言已公开') } catch (e) { toast.error(e instanceof Error ? e.message : '审核失败') } finally { setBusy(false) } }}>通过</Button><Button variant="outline" disabled={busy} onClick={() => setTarget(c)}>删除</Button></div></article>)}<ConfirmDelete title="这条待审核留言" open={!!target} onClose={() => setTarget(null)} onConfirm={async () => { try { await api.post('/api/user/blog/comment/delete', { id: target!.id }); await load() } catch (e) { toast.error(e instanceof Error ? e.message : '删除失败') } }} /></div>
}
