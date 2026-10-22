'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api, sha256Hex } from '@/lib/api-client'
import { useUnsavedChanges } from '@/lib/use-draft'
import { RequestError } from '@/components/ui/request-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
export function AccountSettings({
  account,
  configured,
}: {
  account: { username: string; email: string; avatar: string }
  configured: boolean
}) {
  const [oldPassword, setOld] = useState(''),
    [newPassword, setNew] = useState(''),
    [confirm, setConfirm] = useState('')
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null),
    [avatar, setAvatar] = useState(account.avatar),
    [preview, setPreview] = useState(''),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<unknown>(null)
  const router = useRouter()
  useUnsavedChanges(!!oldPassword || !!newPassword || !!confirm || !!file)
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  async function savePassword(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError(new Error('两次输入的新密码不一致'))
      return
    }
    if (newPassword === oldPassword) {
      setError(new Error('新密码不能与原密码相同'))
      return
    }
    setBusy(true)
    try {
      await api.post('/api/user/auth/change-password', {
        oldPassword: await sha256Hex(oldPassword),
        newPassword: await sha256Hex(newPassword),
      })
      setOld('')
      setNew('')
      setConfirm('')
      toast.success('密码已修改，其他会话已退出')
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  async function uploadAvatar() {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(new Error('头像不能超过 10MB'))
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('purpose', 'avatar')
      const saved = await api.upload<{ url: string }>('/api/user/upload', form)
      setAvatar(saved.url)
      setFile(null)
      toast.success('头像已更新')
      router.refresh()
    } catch (reason) {
      setUploadError(reason)
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>站长账号</CardTitle>
          <CardDescription>管理站长身份与头像。</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-username">用户名</FieldLabel>
                <Input
                  id="account-username"
                  value={account.username}
                  readOnly
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-email">邮箱</FieldLabel>
                <Input id="account-email" value={account.email} readOnly />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="avatar-file">头像</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={preview || avatar} alt="站长头像" />
                  <AvatarFallback>
                    {account.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Input
                  id="avatar-file"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon"
                  disabled={!configured || uploading}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null)
                    setUploadError(null)
                  }}
                />
              </div>
              {!configured ? (
                <FieldDescription>
                  <Link href="/manage/settings/storage" className="underline">
                    配置存储
                  </Link>
                  后即可上传头像。
                </FieldDescription>
              ) : (
                <FieldDescription>
                  支持 JPG、PNG、WebP、GIF，最大 10MB。
                </FieldDescription>
              )}
            </Field>
            {uploadError != null && <RequestError error={uploadError} />}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button
            disabled={!file || uploading || !configured}
            onClick={() => void uploadAvatar()}
          >
            {uploading ? '上传中…' : '更新头像'}
          </Button>
        </CardFooter>
      </Card>
      <form onSubmit={savePassword}>
        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>修改后，其他设备需要重新登录。</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldSet disabled={busy}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="old-password">原密码</FieldLabel>
                  <Input
                    id="old-password"
                    autoComplete="current-password"
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(event) => setOld(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-password">新密码</FieldLabel>
                  <Input
                    id="new-password"
                    autoComplete="new-password"
                    type="password"
                    minLength={12}
                    maxLength={200}
                    required
                    value={newPassword}
                    onChange={(event) => setNew(event.target.value)}
                  />
                  <FieldDescription>至少 12 位。</FieldDescription>
                </Field>
                <Field data-invalid={!!confirm && newPassword !== confirm}>
                  <FieldLabel htmlFor="confirm-password">确认新密码</FieldLabel>
                  <Input
                    id="confirm-password"
                    autoComplete="new-password"
                    type="password"
                    minLength={12}
                    maxLength={200}
                    required
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    aria-invalid={!!confirm && newPassword !== confirm}
                  />
                </Field>
                {error != null && <RequestError error={error} />}
              </FieldGroup>
            </FieldSet>
          </CardContent>
          <CardFooter>
            <Button disabled={busy || !oldPassword || !newPassword || !confirm}>
              {busy ? '修改中…' : '修改密码'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
