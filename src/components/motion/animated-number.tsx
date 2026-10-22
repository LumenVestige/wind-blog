'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return
    const counter = { value: 0 }
    const tween = gsap.to(counter, {
      value,
      duration: 0.85,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = Math.round(counter.value).toLocaleString()
      },
    })
    return () => {
      tween.kill()
    }
  }, [value])
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {value.toLocaleString()}
      </span>
      <span className="sr-only">{value.toLocaleString()}</span>
    </>
  )
}
