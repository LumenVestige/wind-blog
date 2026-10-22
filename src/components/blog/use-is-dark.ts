'use client'

import { useEffect, useState } from 'react'

/** Mirrors the `dark` class ThemeToggle puts on <html>. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setDark(root.classList.contains('dark'))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}
