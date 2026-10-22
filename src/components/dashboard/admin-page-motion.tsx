'use client'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import gsap from 'gsap'
export function AdminPageMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    first = useRef(true)
  const pathname = usePathname(),
    params = useSearchParams(),
    route = pathname + '?' + params.toString()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || first.current) {
      first.current = false
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tween = gsap.fromTo(
      el,
      { y: 8 },
      {
        y: 0,
        duration: 0.18,
        ease: 'power3.out',
        clearProps: 'transform',
        overwrite: true,
      },
    )
    return () => {
      tween.kill()
      gsap.set(el, { clearProps: 'transform' })
    }
  }, [route])
  return (
    <div
      ref={ref}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6"
    >
      {children}
    </div>
  )
}
