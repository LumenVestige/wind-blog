'use client'
import Link from 'next/link'
import { Button } from './button'
import { ClientApiError } from '@/lib/api-client'
export function RequestError({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 p-4">
    <p>{error instanceof Error ? error.message : '加载失败，请重试'}</p>
    <div className="flex gap-2">
      {retry && <Button variant="outline" onClick={retry}>重试</Button>}
      {error instanceof ClientApiError && error.status === 401 && <Button asChild><Link href={`/login?next=${encodeURIComponent(typeof location === 'undefined' ? '/manage' : location.pathname + location.search)}`}>重新登录</Link></Button>}
    </div>
  </div>
}
