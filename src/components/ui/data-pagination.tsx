'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SIZES, paginationItems } from '@/lib/pagination'
import { cn } from '@/lib/utils'

export interface DataPaginationProps {
  page: number
  total: number
  pageSize: number
  onChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  /** Base URL including filters. Public page links remain crawlable. */
  href?: string
  disabled?: boolean
  className?: string
  label?: string
}

export function DataPagination({
  page,
  total,
  pageSize,
  onChange,
  onPageSizeChange,
  href,
  disabled,
  className,
  label = '列表分页',
}: DataPaginationProps) {
  const router = useRouter()
  const id = useId()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(pages, Math.max(1, page))
  const [input, setInput] = useState(String(current))
  useEffect(() => setInput(String(current)), [current, pageSize])
  function url(next: number, size = pageSize) {
    const [pathname, search = ''] = (href || '/').split('?')
    const params = new URLSearchParams(search)
    if (next === 1) params.delete('page')
    else params.set('page', String(next))
    params.set('pageSize', String(size))
    return pathname + (params.size ? `?${params}` : '')
  }
  function change(next: number) {
    if (disabled) return
    if (href !== undefined) router.push(url(next))
    else onChange?.(next)
  }
  function control(next: number, text: string, unavailable = false) {
    const active = next === current && /^\d+$/.test(text)
    const props = {
      variant: active ? ('selected' as const) : ('outline' as const),
      className: 'min-w-9 px-3 tabular-nums',
      'aria-current': active ? ('page' as const) : undefined,
      'aria-label': /^\d+$/.test(text) ? `第 ${next} 页` : text,
    }
    return href !== undefined && !disabled && !unavailable ? (
      <Button key={text} {...props} asChild>
        <Link href={url(next)}>{text}</Link>
      </Button>
    ) : (
      <Button
        key={text}
        type="button"
        {...props}
        disabled={disabled || unavailable}
        onClick={() => change(next)}
      >
        {text}
      </Button>
    )
  }
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-5 text-sm',
        className,
      )}
      aria-label={label}
      aria-busy={disabled}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="whitespace-nowrap text-muted-foreground" role="status">
          共 {total} 条 · 第 {current}/{pages}
        </span>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            const value = /^\d+$/.test(input) ? Number(input) : current
            const next = Math.min(
              pages,
              Math.max(1, Number.isSafeInteger(value) ? value : current),
            )
            setInput(String(next))
            if (next !== current) change(next)
          }}
        >
          <label htmlFor={`${id}-page`} className="sr-only">
            跳转页码
          </label>
          <Input
            id={`${id}-page`}
            className="w-[4.5rem] text-center tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            value={input}
            disabled={disabled || !total}
            onChange={(event) => setInput(event.target.value)}
          />
          <Button variant="outline" type="submit" disabled={disabled || !total}>
            跳转
          </Button>
        </form>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span id={`${id}-size`}>每页</span>
          <Select
            value={String(pageSize)}
            disabled={disabled}
            onValueChange={(value) => {
              if (href !== undefined) router.push(url(1, Number(value)))
              else onPageSizeChange?.(Number(value))
            }}
          >
            <SelectTrigger
              aria-label="每页条数"
              aria-describedby={`${id}-size`}
              className="w-20 bg-background text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Array.from(new Set([pageSize, ...PAGE_SIZES]))
                  .sort((a, b) => a - b)
                  .map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span>条</span>
        </div>
      </div>
      <nav
        aria-label={`${label}页码`}
        className="flex min-w-0 flex-wrap items-center gap-1.5"
      >
        {control(current - 1, '上一页', current <= 1)}
        {paginationItems(current, pages).map((item) =>
          typeof item === 'number' ? (
            control(item, String(item))
          ) : (
            <span
              key={item}
              className="px-1 text-muted-foreground"
              aria-label="更多页码"
            >
              …
            </span>
          ),
        )}
        {control(current + 1, '下一页', current >= pages)}
      </nav>
    </div>
  )
}
