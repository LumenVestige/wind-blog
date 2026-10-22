'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { Button } from './button'
export function ConfirmDelete({ title, open, onClose, onConfirm, description = '删除后无法恢复。' }: { title: string; open: boolean; onClose: () => void; onConfirm: () => Promise<void>; description?: string }) {
  const [busy, setBusy] = useState(false)
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose() }}><DialogContent><DialogHeader><DialogTitle>删除「{title}」？</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>取消</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose() } finally { setBusy(false) } }}>{busy ? '删除中…' : '确认删除'}</Button></DialogFooter></DialogContent></Dialog>
}
