'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientApiError, setToken, sha256Hex } from '@/lib/api-client'

export function SetupForm() {
  const [form, setForm] = useState({
    siteName: 'Wind Blog',
    username: '',
    name: '',
    email: '',
    password: '',
  })
  const [upyun, setUpyun] = useState({
    bucket: '',
    operator: '',
    password: '',
    domain: '',
    scheme: 'https',
  })
  const [showUpyun, setShowUpyun] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const password = await sha256Hex(form.password)
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, password, upyun }),
      })
      const json = (await res.json()) as { jwtToken?: string; message?: string }
      if (!res.ok || !json.jwtToken) throw new ClientApiError(json.message || '初始化失败')
      setToken(json.jwtToken)
      toast.success('初始化完成')
      router.push(`/manage`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>初始化站点</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="siteName">站点名称</Label>
            <Input
              id="siteName"
              value={form.siteName}
              onChange={(e) => update('siteName', e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="3–64 位字母、数字、_ 或 -"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">昵称</Label>
              <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">管理员密码</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              placeholder="至少 12 位"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
            />
          </div>

          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setShowUpyun((v) => !v)}
          >
            {showUpyun ? '收起又拍云设置' : '可选：配置又拍云图床'}
          </button>
          {showUpyun && (
            <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bucket</Label>
                <Input
                  value={upyun.bucket}
                  onChange={(e) => setUpyun({ ...upyun, bucket: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Operator</Label>
                <Input
                  value={upyun.operator}
                  onChange={(e) => setUpyun({ ...upyun, operator: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={upyun.password}
                  onChange={(e) => setUpyun({ ...upyun, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>访问域名（CDN）</Label>
                <Input
                  placeholder="zhiyuansofts.cn"
                  value={upyun.domain}
                  onChange={(e) => setUpyun({ ...upyun, domain: e.target.value })}
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            完成初始化
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
