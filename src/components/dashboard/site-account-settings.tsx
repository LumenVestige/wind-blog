'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api, sha256Hex } from '@/lib/api-client'
import { useUnsavedChanges } from '@/lib/use-draft'
import { RequestError } from '@/components/ui/request-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
type Settings = { siteName: string; faviconUrl: string; icpNumber: string; commentsEnabled: boolean; likesEnabled: boolean }
export function SiteSettings() {
  const [value, setValue] = useState<Settings | null>(null), [baseline, setBaseline] = useState('')
  const [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false)
  const router = useRouter()
  useUnsavedChanges(!!value && JSON.stringify(value) !== baseline)
  const load = useCallback(async () => { setError(null); try { const data = await api.get<Settings>('/api/site/settings'); const next = { siteName: data.siteName, faviconUrl: data.faviconUrl || '', icpNumber: data.icpNumber || '', commentsEnabled: data.commentsEnabled, likesEnabled: data.likesEnabled }; setValue(next); setBaseline(JSON.stringify(next)) } catch (e) { setError(e) } }, [])
  useEffect(() => { void load() }, [load])
  return <section className="space-y-4 rounded-xl border bg-card p-6"><h2 className="font-semibold">站点设置</h2>{error != null && <RequestError error={error} retry={() => void load()} />}{!value ? !error && <p>加载中…</p> : <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); try { await api.post('/api/site/settings', value); setBaseline(JSON.stringify(value)); toast.success('站点设置已保存'); router.refresh() } catch (err) { setError(err) } finally { setBusy(false) } }}>
    <Label htmlFor="site-name">站点名称</Label><Input id="site-name" required maxLength={64} value={value.siteName} onChange={e => setValue({ ...value, siteName: e.target.value })} />
    <Label htmlFor="site-favicon">站点图标（留空则使用头像，没有头像时用默认图标）</Label><Input id="site-favicon" maxLength={1024} placeholder="https:// 或 / 开头的图片地址" value={value.faviconUrl} onChange={e => setValue({ ...value, faviconUrl: e.target.value })} />
    <Label htmlFor="site-icp">备案号（留空则不显示）</Label><Input id="site-icp" maxLength={64} placeholder="例如 京ICP备00000000号" value={value.icpNumber} onChange={e => setValue({ ...value, icpNumber: e.target.value })} />
    <div className="flex items-center gap-3"><Switch id="site-comments" checked={value.commentsEnabled} onCheckedChange={v => setValue({ ...value, commentsEnabled: v })} /><Label htmlFor="site-comments">允许访客留言（经站长审核后公开）</Label></div>
    <div className="flex items-center gap-3"><Switch id="site-likes" checked={value.likesEnabled} onCheckedChange={v => setValue({ ...value, likesEnabled: v })} /><Label htmlFor="site-likes">允许访客点赞</Label></div>
    <Button disabled={busy}>{busy ? '保存中…' : '保存站点设置'}</Button>
  </form>}</section>
}
export function AccountSettings() {
  const [oldPassword, setOld] = useState(''), [newPassword, setNew] = useState(''), [confirm, setConfirm] = useState('')
  const [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false)
  return <section id="account" className="space-y-4 rounded-xl border bg-card p-6"><h2 className="font-semibold">修改站长密码</h2><form className="max-w-md space-y-3" onSubmit={async e => { e.preventDefault(); if (newPassword !== confirm) { setError(new Error('两次新密码不一致')); return } setBusy(true); setError(null); try { await api.post('/api/user/auth/change-password', { oldPassword: await sha256Hex(oldPassword), newPassword: await sha256Hex(newPassword) }); setOld(''); setNew(''); setConfirm(''); toast.success('密码已修改，其他会话已退出') } catch (err) { setError(err) } finally { setBusy(false) } }}>
    <Label htmlFor="old-password">原密码</Label><Input id="old-password" autoComplete="current-password" type="password" required value={oldPassword} onChange={e => setOld(e.target.value)} />
    <Label htmlFor="new-password">新密码（至少 12 位）</Label><Input id="new-password" autoComplete="new-password" type="password" minLength={12} required value={newPassword} onChange={e => setNew(e.target.value)} />
    <Label htmlFor="confirm-password">确认新密码</Label><Input id="confirm-password" autoComplete="new-password" type="password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} />
    {error != null && <RequestError error={error} />}<Button disabled={busy}>{busy ? '修改中…' : '修改密码'}</Button>
  </form></section>
}
