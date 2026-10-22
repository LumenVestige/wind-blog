import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(input: string | number | null | undefined): string {
  if (!input) return ''
  const d = typeof input === 'number' ? new Date(input * 1000) : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(input: string | number | null | undefined): string {
  if (!input) return ''
  const d = typeof input === 'number' ? new Date(input * 1000) : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Convert an ISO datetime string (SQLite) to unix seconds. */
export function isoToUnix(iso: string | null | undefined): number {
  if (!iso) return 0
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000)
}

/** Bounded integers keep SQLite LIMIT/OFFSET valid even for malformed inputs. */
export function boundedInt(value: unknown, fallback: number, max = 100): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(1, Math.trunc(n))) : fallback
}
