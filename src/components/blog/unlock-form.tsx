'use client'

import { useState } from 'react'
import { useBlogRouter } from './blog-navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api, ClientApiError } from '@/lib/api-client'

export function UnlockForm({ articleId }: { articleId: number }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useBlogRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/user/blog/article/unlock', { id: articleId, password })
      toast.success('已解锁')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : '解锁失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        type="password"
        placeholder="请输入访问密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" disabled={loading}>
        解锁
      </Button>
    </form>
  )
}
