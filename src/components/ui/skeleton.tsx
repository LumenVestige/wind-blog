'use client'

import { useFadeOutOnUnmount } from '@/components/motion/use-fade-out-on-unmount'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  const ref = useFadeOutOnUnmount<HTMLDivElement>()

  return (
    <div
      {...props}
      ref={ref}
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
    />
  )
}

export { Skeleton }
