'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
export function AdminHeading({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent className={cn(!title && 'pt-5')}>{children}</CardContent>
    </Card>
  )
}
export function AdminEmpty({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
export function AdminLoading() {
  return (
    <div
      className="flex flex-col gap-4 p-6"
      role="status"
      aria-label="正在加载"
    >
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}
export function AdminStatus({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  return (
    <Badge
      variant={
        tone === 'success'
          ? 'default'
          : tone === 'warning'
            ? 'outline'
            : 'secondary'
      }
    >
      {children}
    </Badge>
  )
}
export function AdminPagination({
  page,
  total,
  pageSize,
  onChange,
  disabled,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  disabled?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
      <span className="text-xs text-muted-foreground">
        共 {total} 项 · 第 {page} / {pages} 页
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft data-icon="inline-start" />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          下一页
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
/** Ignore stale responses after search changes or navigation. */
export function useAdminQuery<T>(
  url: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const query = JSON.stringify(params)
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<T>(url, JSON.parse(query))
      if (request === sequence.current) setData(result)
    } catch (reason) {
      if (request === sequence.current) setError(reason)
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [url, query])
  useEffect(() => {
    void refresh()
    return () => {
      sequence.current += 1
    }
  }, [refresh])
  return { data, setData, error, loading, refresh }
}
