'use client'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './alert'
import { Button } from './button'
import { ClientApiError } from '@/lib/api-client'
export function RequestError({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>操作未完成</AlertTitle>
      <AlertDescription>
        <p>{error instanceof Error ? error.message : '请稍后重试'}</p>
        {(retry ||
          (error instanceof ClientApiError && error.status === 401)) && (
          <div className="mt-2 flex gap-2">
            {retry && (
              <Button type="button" size="sm" variant="outline" onClick={retry}>
                重试
              </Button>
            )}
            {error instanceof ClientApiError && error.status === 401 && (
              <Button type="button" size="sm" asChild>
                <Link
                  href={`/login?next=${encodeURIComponent(typeof location === 'undefined' ? '/manage' : location.pathname + location.search)}`}
                >
                  重新登录
                </Link>
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
