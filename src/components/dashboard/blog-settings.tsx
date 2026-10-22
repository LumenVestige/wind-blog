'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SiteSettings, AccountSettings } from './site-account-settings'
import { RequestError } from '@/components/ui/request-error'
import { useUnsavedChanges } from '@/lib/use-draft'
import { api, ClientApiError } from '@/lib/api-client'

interface SocialLink {
  type: string
  url: string
  label?: string
}
interface Theme {
  themeId: string
  colorScheme: string
  subtitle: string
  socialLinks: SocialLink[]
  aboutMd: string
  homeIntroMd: string
  friendsMd: string
}

const THEMES = [
  {
    id: 'mizuki',
    label: 'Mizuki',
    description: '毛玻璃顶栏 + 渐变卡片，Material Design 3 气质',
    credit: 'LyraVoid/Mizuki',
    creditUrl: 'https://github.com/LyraVoid/Mizuki',
    badge: '默认',
  },
  {
    id: 'chirpy',
    label: 'Chirpy',
    description: '左侧栏 + 文章卡片，经典技术博客风格',
  },
  {
    id: 'simple',
    label: '简约',
    description: '顶栏导航 + 卡片列表，贴近主站风格',
  },
] as const

const SCHEMES = [
  { id: 'system', label: '跟随系统', description: '随读者设备的明暗设置', badge: '推荐默认' },
  { id: 'light', label: '浅色', description: '始终使用浅色' },
  { id: 'dark', label: '深色', description: '始终使用深色' },
] as const

const SOCIALS = [
  { type: 'github', label: 'GitHub', placeholder: 'https://github.com/you' },
  { type: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/you' },
  { type: 'email', label: '邮箱', placeholder: 'mailto:you@example.com' },
  { type: 'rss', label: 'RSS', placeholder: 'https://…/feed.xml' },
  { type: 'bilibili', label: 'Bilibili', placeholder: 'https://space.bilibili.com/…' },
  { type: 'zhihu', label: '知乎', placeholder: 'https://www.zhihu.com/people/…' },
  { type: 'custom', label: '自定义链接', placeholder: 'https://…' },
]

export function BlogSettings({ username, name }: { username: string; name: string }) {
  const [theme, setTheme] = useState<Theme | null>(null)
  const [profile, setProfile] = useState({ name })
  const [upyun, setUpyun] = useState({
    bucket: '',
    operator: '',
    password: '',
    domain: '',
    scheme: 'https',
    apiHost: '',
    uploadDir: 'blog',
    hasPassword: false,
    publicBaseUrl: '',
    configured: false,
  })
  const [savingUpyun, setSavingUpyun] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const [error, setError] = useState<unknown>(null)
  const [themeBase, setThemeBase] = useState('')
  const [cdnBase, setCdnBase] = useState('')
  const [profileBase, setProfileBase] = useState(name)
  useUnsavedChanges(!!theme && JSON.stringify(theme) !== themeBase || !!cdnBase && JSON.stringify(upyun) !== cdnBase || profile.name !== profileBase)

  const reload = useCallback(async () => {
    setError(null)
    const [th, cdn] = await Promise.allSettled([
      api.get<Theme>('/api/user/blog/theme/status', { username }),
      api.get<typeof upyun>('/api/user/blog/upyun'),
    ])
    if (th.status === 'fulfilled') { setTheme(th.value); setThemeBase(JSON.stringify(th.value)) }
    for (const result of [th, cdn]) if (result.status === 'rejected') setError(result.reason)
    if (cdn.status === 'fulfilled') {
      const next = {
        bucket: cdn.value.bucket || '',
        operator: cdn.value.operator || '',
        password: '',
        domain: cdn.value.domain || '',
        scheme: cdn.value.scheme || 'https',
        apiHost: cdn.value.apiHost || '',
        uploadDir: cdn.value.uploadDir || 'blog',
        hasPassword: !!cdn.value.hasPassword,
        publicBaseUrl: cdn.value.publicBaseUrl || '',
        configured: !!cdn.value.configured,
      }; setUpyun(next); setCdnBase(JSON.stringify(next))
    }
  }, [username])

  useEffect(() => {
    void reload()
  }, [reload])

  async function guard(fn: () => Promise<unknown>, okMsg: string) {
    try {
      await fn()
      toast.success(okMsg)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ClientApiError ? e.message : '操作失败')
    }
  }

  async function uploadAvatar(file: File) {
    const form = new FormData()
    form.append('file', file)
    form.append('purpose', 'avatar')
    await guard(() => api.upload('/api/user/upload', form), '头像已更新')
  }

  async function saveTheme(e: React.FormEvent) {
    e.preventDefault()
    if (!theme) return
    setSaving(true)
    try {
      await api.post('/api/user/blog/theme/config', {
        themeId: theme.themeId,
        colorScheme: theme.colorScheme,
        subtitle: theme.subtitle,
        socialLinks: theme.socialLinks
          .map((l) => ({
            type: l.type.trim().toLowerCase(),
            url: l.url.trim(),
            label: (l.label || '').trim() || undefined,
          }))
          .filter((l) => l.type && l.url),
        aboutMd: theme.aboutMd,
        homeIntroMd: theme.homeIntroMd,
        friendsMd: theme.friendsMd,
      })
      setThemeBase(JSON.stringify(theme))
      toast.success('外观已保存')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof ClientApiError ? err.message : '没保存上')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <RequestError error={error} retry={() => void reload()} />
  if (!theme || !cdnBase) return <p className="text-muted-foreground">加载中…</p>

  return (
    <div className="flex flex-col gap-6">
      <SiteSettings />
      {error != null && <RequestError error={error} retry={() => void reload()} />}

      <form onSubmit={saveTheme} className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">外观设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">选择布局主题和读者默认明暗。</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>主题</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((meta) => {
              const active = theme.themeId === meta.id
              return (
                <button
                  key={meta.id}
                  type="button"
                  onClick={() => setTheme({ ...theme, themeId: meta.id })}
                  className={
                    active
                      ? 'rounded-xl border-2 border-primary bg-primary/5 p-4 text-left'
                      : 'rounded-xl border p-4 text-left hover:bg-muted/50'
                  }
                >
                  <div className="font-medium">{meta.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                  {'badge' in meta && meta.badge ? (
                    <span className="mt-2 inline-block text-[11px] text-primary">{meta.badge}</span>
                  ) : null}
                  {'creditUrl' in meta && meta.creditUrl ? (
                    <a
                      href={meta.creditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-[11px] text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      来源：{meta.credit}
                    </a>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>默认明暗</Label>
          <p className="text-xs text-muted-foreground">读者第一次打开时的外观；选「跟随系统」则随对方设备。</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCHEMES.map((opt) => {
              const active = theme.colorScheme === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme({ ...theme, colorScheme: opt.id })}
                  className={
                    active
                      ? 'rounded-xl border-2 border-primary bg-primary/5 p-3 text-left'
                      : 'rounded-xl border p-3 text-left hover:bg-muted/50'
                  }
                >
                  <div className="font-medium">{opt.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
                  {'badge' in opt && opt.badge ? (
                    <span className="mt-2 inline-block text-[11px] text-primary">{opt.badge}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="blog-subtitle">副标题 / 简介</Label>
          <Input
            id="blog-subtitle"
            value={theme.subtitle}
            maxLength={200}
            placeholder="一句话介绍你的博客（可选）"
            onChange={(e) => setTheme({ ...theme, subtitle: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="blog-home-intro">首页介绍</Label>
          <Textarea
            id="blog-home-intro"
            rows={4}
            value={theme.homeIntroMd}
            placeholder="显示在文章列表上方（支持 Markdown，可选）"
            onChange={(e) => setTheme({ ...theme, homeIntroMd: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="blog-about-md">关于</Label>
          <Textarea
            id="blog-about-md"
            rows={6}
            value={theme.aboutMd}
            placeholder="关于页内容（支持 Markdown，留空用默认）"
            onChange={(e) => setTheme({ ...theme, aboutMd: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="blog-friends-md">友链</Label>
          <Textarea
            id="blog-friends-md"
            rows={6}
            value={theme.friendsMd}
            placeholder="友链页内容（支持 Markdown，留空不显示入口）"
            onChange={(e) => setTheme({ ...theme, friendsMd: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label>外链图标</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setTheme({ ...theme, socialLinks: [...theme.socialLinks, { type: 'github', url: '' }] })
              }
            >
              <Plus className="size-3.5" />
              添加
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Chirpy 在左下角，Mizuki 在右侧资料卡；留空则不显示。</p>
          {theme.socialLinks.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              还没有添加外链
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {theme.socialLinks.map((l, i) => (
                <li key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[140px_1fr_1fr_auto]">
                  <Select
                    value={l.type || 'custom'}
                    onValueChange={(v) => {
                      const next = [...theme.socialLinks]
                      next[i] = { ...next[i], type: v }
                      setTheme({ ...theme, socialLinks: next })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIALS.map((p) => (
                        <SelectItem key={p.type} value={p.type}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={l.url}
                    placeholder={SOCIALS.find((p) => p.type === l.type)?.placeholder || 'https://…'}
                    onChange={(e) => {
                      const next = [...theme.socialLinks]
                      next[i] = { ...next[i], url: e.target.value }
                      setTheme({ ...theme, socialLinks: next })
                    }}
                  />
                  <Input
                    value={l.label || ''}
                    placeholder="显示名称（可选）"
                    onChange={(e) => {
                      const next = [...theme.socialLinks]
                      next[i] = { ...next[i], label: e.target.value }
                      setTheme({ ...theme, socialLinks: next })
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="删除"
                    onClick={() =>
                      setTheme({
                        ...theme,
                        socialLinks: theme.socialLinks.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存外观'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/`}>打开博客</Link>
          </Button>
        </div>
      </form>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">个人资料</h2>
        {!upyun.configured && <p className="mt-2 text-sm text-muted-foreground">头像上传需要先配置下方又拍云 CDN。</p>}
        <div className="mt-4 flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label>昵称</Label>
            <Input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>头像</Label>
            <input
              type="file"
              disabled={!upyun.configured}
              accept="image/jpeg,image/png,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadAvatar(f)
              }}
            />
          </div>
          <Button className="w-fit" onClick={() => guard(async () => { await api.post('/api/user/profile/update', profile); setProfileBase(profile.name) }, '已保存资料')}>
            保存资料
          </Button>
        </div>
      </section>

      <section id="cdn" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">又拍云 CDN</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          填写存储空间和 CDN 域名。文章图片、头像会上传到这里，阅读时按这个域名展开。
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>CDN 域名</Label>
            <Input
              placeholder="cdn.example.com"
              value={upyun.domain}
              onChange={(e) => setUpyun({ ...upyun, domain: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>协议</Label>
            <Select value={upyun.scheme} onValueChange={(v) => setUpyun({ ...upyun, scheme: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="https">https</SelectItem>
                <SelectItem value="http">http</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>存储空间 Bucket</Label>
            <Input value={upyun.bucket} onChange={(e) => setUpyun({ ...upyun, bucket: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>操作员</Label>
            <Input value={upyun.operator} onChange={(e) => setUpyun({ ...upyun, operator: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>操作员密码</Label>
            <Input
              type="password"
              placeholder={upyun.hasPassword ? '已保存，留空则不修改' : '操作员密码'}
              value={upyun.password}
              onChange={(e) => setUpyun({ ...upyun, password: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>上传目录</Label>
            <Input
              placeholder="blog"
              value={upyun.uploadDir}
              onChange={(e) => setUpyun({ ...upyun, uploadDir: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              新图片会存到这个目录下，例如 {upyun.uploadDir.trim() || 'blog'}/文件名.jpg。已上传的图片路径不变。
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>API 地址（可选）</Label>
            <Input
              placeholder="https://v0.api.upyun.com"
              value={upyun.apiHost}
              onChange={(e) => setUpyun({ ...upyun, apiHost: e.target.value })}
            />
          </div>
        </div>
        {upyun.publicBaseUrl ? (
          <p className="mt-3 text-sm text-muted-foreground">当前访问地址：{upyun.publicBaseUrl}</p>
        ) : null}
        <Button
          className="mt-4"
          disabled={savingUpyun}
          onClick={async () => {
            setSavingUpyun(true)
            try {
              const saved = await api.post<typeof upyun>('/api/user/blog/upyun', upyun)
              toast.success('又拍云 CDN 已保存')
              const next = { ...upyun, ...saved, password: '' }; setUpyun(next); setCdnBase(JSON.stringify(next))
            } catch (e) {
              toast.error(e instanceof ClientApiError ? e.message : '没保存上')
            } finally {
              setSavingUpyun(false)
            }
          }}
        >
          {savingUpyun ? '保存中…' : '保存又拍云'}
        </Button>
      </section>

      <AccountSettings />
    </div>
  )
}
