'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Mode = 'light' | 'dark' | 'system'
const KEY = 'wind-theme'

function apply(mode: Mode): void {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeToggle({
  variant = 'button',
  className,
}: {
  variant?: 'button' | 'cycle'
  className?: string
}) {
  const [mode, setMode] = useState<Mode>('system')

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Mode | null) || 'system'
    setMode(saved)
    apply(saved)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const cur = (localStorage.getItem(KEY) as Mode | null) || 'system'
      if (cur === 'system') apply('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function set(next: Mode) {
    setMode(next)
    localStorage.setItem(KEY, next)
    apply(next)
  }

  function cycle() {
    set(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')
  }

  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor
  const title = mode === 'dark' ? '深色' : mode === 'light' ? '浅色' : '跟随系统'

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`切换主题（当前：${title}）`}
      title={title}
      className={cn(variant === 'button' && 'inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent', className)}
    >
      <Icon className="size-4" />
    </button>
  )
}

/** Apply the blog's default color scheme on first visit (no stored preference). */
export function ThemeInit({ scheme }: { scheme: string }) {
  useEffect(() => {
    if (localStorage.getItem(KEY)) return
    const mode: Mode = scheme === 'light' || scheme === 'dark' ? scheme : 'system'
    localStorage.setItem(KEY, mode)
    apply(mode)
  }, [scheme])
  return null
}
