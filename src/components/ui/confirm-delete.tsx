'use client'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from './alert-dialog'
import { Button } from './button'
import { RequestError } from './request-error'
export function ConfirmDelete({
  title,
  open,
  onClose,
  onConfirm,
  description = '删除后无法恢复。',
}: {
  title: string
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  description?: string
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (open) setError(null)
  }, [open])
  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除「{title}」？</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error != null && <RequestError error={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? '删除中…' : '确认删除'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
