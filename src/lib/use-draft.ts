'use client'
import { useEffect, useRef, useState } from 'react'

const dirtySources = new Map<symbol, () => boolean>()
function hasUnsavedChanges() { return [...dirtySources.values()].some(read => read()) }
export function confirmUnsavedNavigation() { return !hasUnsavedChanges() || window.confirm('还有未保存的修改，确定离开吗？') }
function beforeUnload(e: BeforeUnloadEvent) { if (hasUnsavedChanges()) { e.preventDefault(); e.returnValue = '' } }
function beforeLink(e: MouseEvent) {
  const a = (e.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || a.target === '_blank' || a.download || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const target = new URL(a.href, location.href)
  if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search) return
  if (!confirmUnsavedNavigation()) { e.preventDefault(); e.stopPropagation() }
}
export function useUnsavedChanges(dirty: boolean) {
  const ref = useRef(dirty)
  ref.current = dirty
  useEffect(() => {
    const id = Symbol('form')
    dirtySources.set(id, () => ref.current)
    if (dirtySources.size === 1) { window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', beforeLink, true) }
    return () => { dirtySources.delete(id); if (!dirtySources.size) { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', beforeLink, true) } }
  }, [])
  return () => { ref.current = false }
}

export function useLocalDraft<T>(key: string, value: T, dirty: boolean, ready: boolean) {
  const [stored, setStored] = useState<{ value: T; savedAt: string } | null>(null)
  const [status, setStatus] = useState('')
  const cleared = useRef(false)
  useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setStored(JSON.parse(raw)) } catch { setStatus('浏览器无法保存本地草稿，请及时手动保存') }
  }, [key])
  useEffect(() => {
    if (!ready || !dirty || cleared.current || stored) return
    const save = () => {
      try { localStorage.setItem(key, JSON.stringify({ value, savedAt: new Date().toISOString() })); setStatus('本地草稿已保存') }
      catch { setStatus('本地草稿保存失败，请及时手动保存') }
    }
    const timer = setTimeout(save, 500)
    window.addEventListener('pagehide', save)
    window.addEventListener('beforeunload', save)
    // Save the latest input on navigation, including browser back.
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', save); window.removeEventListener('beforeunload', save); if (!cleared.current) save() }
  }, [key, value, dirty, ready, stored])
  function discard() { try { localStorage.removeItem(key) } catch {} setStored(null) }
  function clear() { cleared.current = true; discard(); setStatus('已保存到服务器') }
  return { stored, status, discard, clear }
}
