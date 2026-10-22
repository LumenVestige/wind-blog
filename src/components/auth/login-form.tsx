'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loginWithPassword, ClientApiError } from '@/lib/api-client'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await loginWithPassword(username, password)
      toast.success('登录成功')
      const next = new URLSearchParams(window.location.search).get('next') || '/manage'
      router.replace(next.startsWith('/') && !next.startsWith('//') && !/[\\\x00-\x1f]/.test(next) ? next : '/manage')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>登录</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">用户名或邮箱</Label>
            <Input
              autoComplete="username"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">密码</Label>
            <Input
              autoComplete="current-password"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            登录
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
