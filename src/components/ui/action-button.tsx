'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'

export function ActionButton({
  pending,
  successKey,
  children,
  disabled,
  ...props
}: ButtonProps & {
  pending: boolean
  successKey?: string
}) {
  const previous = useRef(successKey)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (previous.current === successKey) return
    previous.current = successKey
    setSaved(true)
    const timer = setTimeout(() => setSaved(false), 1600)
    return () => clearTimeout(timer)
  }, [successKey])
  return (
    <Button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      data-pending={pending || undefined}
      data-saved={saved || undefined}
    >
      {pending ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      ) : saved ? (
        <Check data-icon="inline-start" className="motion-success-icon" />
      ) : null}
      <span aria-live="polite">{saved && !pending ? '已保存' : children}</span>
    </Button>
  )
}
