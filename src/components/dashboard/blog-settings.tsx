'use client'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, ClientApiError } from '@/lib/api-client'
import { useUnsavedChanges } from '@/lib/use-draft'
import type {
  SettingsSection,
  SettingsSnapshot,
  SettingsValues,
} from '@/lib/admin-settings'
import { settingsNav } from '@/lib/admin-nav'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { RequestError } from '@/components/ui/request-error'
import { AdminHeading } from './admin-ui'
import { AccountSettings } from './site-account-settings'
import { uiFontOptions, englishFontOptions, codeFontOptions } from '@/lib/typography'

function useModule<S extends SettingsSection>(
  section: S,
  initial: SettingsSnapshot[S],
) {
  const [value, setValue] = useState<SettingsValues[S]>(initial.values)
  const [baseline, setBaseline] = useState(initial)
  const [saveCount, setSaveCount] = useState(0)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null)
  const router = useRouter(),
    dirty = JSON.stringify(value) !== JSON.stringify(baseline.values)
  useUnsavedChanges(dirty)
  function change<K extends keyof SettingsValues[S]>(
    key: K,
    next: SettingsValues[S][K],
  ) {
    setValue((previous) => ({ ...previous, [key]: next }))
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || !dirty) return
    setBusy(true)
    setError(null)
    try {
      const saved = await api.post<SettingsSnapshot[S]>(
        '/api/manage/settings',
        { section, values: value, version: baseline.version },
      )
      setValue(saved.values)
      setBaseline(saved)
      setSaveCount((count) => count + 1)
      toast.success('设置已保存')
      router.refresh()
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  async function reload() {
    if (!window.confirm('重新加载会放弃本模块未保存的修改，确定继续吗？'))
      return
    setBusy(true)
    try {
      const saved = (await api.get<SettingsSnapshot>('/api/manage/settings'))[
        section
      ] as SettingsSnapshot[S]
      setValue(saved.values)
      setBaseline(saved)
      setError(null)
    } catch (reason) {
      setError(reason)
    } finally {
      setBusy(false)
    }
  }
  return {
    value,
    successKey: String(saveCount),
    change,
    busy,
    dirty,
    error,
    save,
    reload,
    reset: () => {
      setValue(baseline.values)
      setError(null)
    },
  }
}
type ModuleState = {
  successKey: string
  busy: boolean
  dirty: boolean
  error: unknown
  save: (event: FormEvent) => Promise<void>
  reset: () => void
  reload: () => Promise<void>
}
function ModuleForm({
  title,
  description,
  state,
  children,
}: {
  title: string
  description: string
  state: ModuleState
  children: ReactNode
}) {
  return (
    <form onSubmit={state.save}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet disabled={state.busy}>
            <FieldGroup>{children}</FieldGroup>
          </FieldSet>
          {state.error != null && (
            <div className="mt-5">
              <RequestError error={state.error} />
              {state.error instanceof ClientApiError &&
                state.error.status === 409 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={state.busy}
                    onClick={() => void state.reload()}
                  >
                    重新加载此模块
                  </Button>
                )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-4">
          <p className="text-xs text-muted-foreground" role="status">
            {state.dirty ? '有未保存的修改' : '所有修改已保存'}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!state.dirty || state.busy}
              onClick={state.reset}
            >
              撤销修改
            </Button>
            <ActionButton
              type="submit"
              pending={state.busy}
              successKey={state.successKey}
              disabled={!state.dirty}
            >
              {state.busy ? '保存中…' : '保存修改'}
            </ActionButton>
          </div>
        </CardFooter>
      </Card>
    </form>
  )
}
function TextField({
  id,
  label,
  value,
  onChange,
  description,
  required,
  maxLength,
  placeholder,
  type = 'text',
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  description?: string
  required?: boolean
  maxLength?: number
  placeholder?: string
  type?: string
  autoComplete?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
function General({ initial }: { initial: SettingsSnapshot['general'] }) {
  const form = useModule('general', initial),
    { value, change } = form
  return (
    <ModuleForm
      title="基本信息"
      description="设置读者看到的站点名称与身份。"
      state={form}
    >
      <TextField
        id="site-name"
        label="站点名称"
        value={value.siteName}
        onChange={(value) => change('siteName', value)}
        required
        maxLength={64}
      />
      <TextField
        id="display-name"
        label="站长昵称"
        value={value.displayName}
        onChange={(value) => change('displayName', value)}
        required
        maxLength={64}
      />
      <TextField
        id="favicon"
        label="站点图标"
        value={value.faviconUrl}
        onChange={(value) => change('faviconUrl', value)}
        maxLength={1024}
        placeholder="https://… 或 /…"
        description="留空使用站长头像。"
      />
      <TextField
        id="icp"
        label="备案号"
        value={value.icpNumber}
        onChange={(value) => change('icpNumber', value)}
        maxLength={64}
        placeholder="可选"
      />
    </ModuleForm>
  )
}
function FontField({ id, label, value, options, description, onChange }: {
  id: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  description: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-describedby={`${id}-description`}><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectGroup></SelectContent>
      </Select>
      <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
    </Field>
  )
}
function Appearance({ initial }: { initial: SettingsSnapshot['appearance'] }) {
  const form = useModule('appearance', initial),
    { value, change } = form
  return (
    <ModuleForm
      title="外观"
      description="Mizuki 是当前维护的博客主题。"
      state={form}
    >
      <Field>
        <FieldLabel id="scheme-label">默认明暗</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={value.colorScheme}
          onValueChange={(value) => {
            if (value)
              change(
                'colorScheme',
                value as SettingsValues['appearance']['colorScheme'],
              )
          }}
          aria-labelledby="scheme-label"
        >
          <ToggleGroupItem value="system">
            <Monitor />
            跟随系统
          </ToggleGroupItem>
          <ToggleGroupItem value="light">
            <Sun />
            浅色
          </ToggleGroupItem>
          <ToggleGroupItem value="dark">
            <Moon />
            深色
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>读者仍可自行切换明暗模式。</FieldDescription>
      </Field>
      <FieldGroup className="rounded-lg border p-4">
        <FontField
          id="body-font"
          label="正文字体"
          value={value.wenkaiEnabled ? 'wenkai' : 'system'}
          options={[{ value: 'system', label: '系统字体' }, { value: 'wenkai', label: '霞鹜文楷' }]}
          onChange={(font) => change('wenkaiEnabled', font === 'wenkai')}
          description="用于文章、静态页面和 Markdown 正文，默认使用系统字体。"
        />
        <FontField
          id="ui-font"
          label="界面 UI 字体"
          value={value.uiFont}
          options={uiFontOptions}
          onChange={(font) => change('uiFont', font as SettingsValues['appearance']['uiFont'])}
          description="用于导航、按钮、侧栏和后台界面，可与正文分别设置。"
        />
        <FontField
          id="english-font"
          label="英文字体"
          value={value.englishFont}
          options={englishFontOptions}
          onChange={(font) => change('englishFont', font as SettingsValues['appearance']['englishFont'])}
          description="用于正文和界面的英文、数字；遵循正文时不额外替换，使用各自字体自带的英文。"
        />
        <FontField
          id="code-font"
          label="代码块字体"
          value={value.codeFont}
          options={codeFontOptions}
          onChange={(font) => change('codeFont', font as SettingsValues['appearance']['codeFont'])}
          description="独立用于代码块和源码编辑区，优先于英文字体设置。"
        />
      </FieldGroup>
      <TextField
        id="subtitle"
        label="博客简介"
        value={value.subtitle}
        onChange={(value) => change('subtitle', value)}
        maxLength={200}
        placeholder="一句话介绍你的博客"
      />
    </ModuleForm>
  )
}
function Content({ initial }: { initial: SettingsSnapshot['content'] }) {
  const form = useModule('content', initial),
    { value, change } = form
  return (
    <ModuleForm
      title="页面内容"
      description="编辑首页介绍、关于页和友链页。支持 Markdown。"
      state={form}
    >
      <Tabs defaultValue="homeIntroMd">
        <TabsList>
          <TabsTrigger value="homeIntroMd">首页介绍</TabsTrigger>
          <TabsTrigger value="aboutMd">关于</TabsTrigger>
          <TabsTrigger value="friendsMd">友链</TabsTrigger>
        </TabsList>
        {(
          [
            {
              key: 'homeIntroMd',
              label: '首页介绍',
              help: '显示在首页文章列表上方。',
            },
            {
              key: 'aboutMd',
              label: '关于页内容',
              help: '介绍你自己与这个博客。',
            },
            {
              key: 'friendsMd',
              label: '友链页内容',
              help: '留空时隐藏友链入口。',
            },
          ] as const
        ).map((item) => (
          <TabsContent key={item.key} value={item.key}>
            <Field>
              <FieldLabel htmlFor={item.key}>{item.label}</FieldLabel>
              <Textarea
                id={item.key}
                value={value[item.key]}
                onChange={(event) => change(item.key, event.target.value)}
                className="min-h-80 font-mono"
                maxLength={200000}
              />
              <FieldDescription>{item.help}</FieldDescription>
            </Field>
          </TabsContent>
        ))}
      </Tabs>
    </ModuleForm>
  )
}
const socials = [
  { id: 'github', label: 'GitHub' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'email', label: '邮箱' },
  { id: 'rss', label: 'RSS' },
  { id: 'bilibili', label: 'Bilibili' },
  { id: 'zhihu', label: '知乎' },
  { id: 'custom', label: '自定义' },
]
function Social({ initial }: { initial: SettingsSnapshot['social'] }) {
  const form = useModule('social', initial),
    { value, change } = form
  function update(
    index: number,
    patch: Partial<SettingsValues['social']['socialLinks'][number]>,
  ) {
    change(
      'socialLinks',
      value.socialLinks.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    )
  }
  return (
    <ModuleForm
      title="社交链接"
      description="展示在博客右侧的个人资料卡中。"
      state={form}
    >
      {value.socialLinks.length === 0 && (
        <p className="text-sm text-muted-foreground">还没有添加社交链接。</p>
      )}
      {value.socialLinks.map((item, index) => (
        <FieldSet key={index} className="rounded-lg border p-4">
          <FieldGroup className="gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">链接 {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`移除链接 ${index + 1}`}
                onClick={() =>
                  change(
                    'socialLinks',
                    value.socialLinks.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 />
              </Button>
            </div>
            <Field>
              <FieldLabel htmlFor={`social-type-${index}`}>平台</FieldLabel>
              <Select
                value={item.type}
                onValueChange={(type) => update(index, { type })}
              >
                <SelectTrigger id={`social-type-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {socials.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                    {!socials.some((option) => option.id === item.type) && (
                      <SelectItem value={item.type}>{item.type}</SelectItem>
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <TextField
              id={`social-url-${index}`}
              label="链接地址"
              value={item.url}
              onChange={(url) => update(index, { url })}
              required
              maxLength={1024}
              placeholder={
                item.type === 'email' ? 'mailto:you@example.com' : 'https://…'
              }
            />
            <TextField
              id={`social-label-${index}`}
              label="显示名称"
              value={item.label || ''}
              onChange={(label) => update(index, { label })}
              maxLength={64}
              placeholder="可选"
            />
          </FieldGroup>
        </FieldSet>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={value.socialLinks.length >= 20}
        className="w-fit"
        onClick={() =>
          change('socialLinks', [
            ...value.socialLinks,
            { type: 'github', url: '', label: '' },
          ])
        }
      >
        <Plus data-icon="inline-start" />
        添加链接
      </Button>
    </ModuleForm>
  )
}
function Interaction({
  initial,
}: {
  initial: SettingsSnapshot['interaction']
}) {
  const form = useModule('interaction', initial),
    { value, change } = form
  return (
    <ModuleForm
      title="访客互动"
      description="控制读者参与博客互动的方式。"
      state={form}
    >
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="comments-enabled">允许访客留言</FieldLabel>
          <FieldDescription>新留言审核通过后公开。</FieldDescription>
        </FieldContent>
        <Switch
          id="comments-enabled"
          checked={value.commentsEnabled}
          onCheckedChange={(value) => change('commentsEnabled', value)}
        />
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="likes-enabled">允许访客点赞</FieldLabel>
          <FieldDescription>读者可为文章与公开留言点赞。</FieldDescription>
        </FieldContent>
        <Switch
          id="likes-enabled"
          checked={value.likesEnabled}
          onCheckedChange={(value) => change('likesEnabled', value)}
        />
      </Field>
    </ModuleForm>
  )
}
function Storage({ initial }: { initial: SettingsSnapshot['storage'] }) {
  const form = useModule('storage', initial),
    { value, change } = form
  return (
    <ModuleForm
      title="存储与上传"
      description="使用又拍云存储文章图片、头像和静态站点。"
      state={form}
    >
      <div className="flex items-center gap-2">
        <Badge variant={value.configured ? 'default' : 'secondary'}>
          {value.configured ? '已配置' : '未配置'}
        </Badge>
        {value.publicBaseUrl && (
          <span className="break-all text-xs text-muted-foreground">
            {value.publicBaseUrl}
          </span>
        )}
      </div>
      <TextField
        id="cdn-domain"
        label="CDN 域名"
        value={value.domain}
        onChange={(value) => change('domain', value)}
        required
        maxLength={1024}
        placeholder="cdn.example.com"
      />
      <TextField
        id="cdn-bucket"
        label="存储空间"
        value={value.bucket}
        onChange={(value) => change('bucket', value)}
        required
        maxLength={128}
      />
      <TextField
        id="cdn-operator"
        label="操作员"
        value={value.operator}
        onChange={(value) => change('operator', value)}
        required
        maxLength={128}
        autoComplete="off"
      />
      <TextField
        id="cdn-password"
        label="操作员密码"
        type="password"
        value={value.password}
        onChange={(value) => change('password', value)}
        required={!value.hasPassword}
        maxLength={512}
        autoComplete="new-password"
        placeholder={
          value.hasPassword ? '已保存，留空保留原密码' : '输入操作员密码'
        }
      />
      <TextField
        id="cdn-directory"
        label="上传目录"
        value={value.uploadDir}
        onChange={(value) => change('uploadDir', value)}
        required
        maxLength={256}
        placeholder="blog"
      />
      <Collapsible className="group/advanced">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between"
          >
            高级选项
            <ChevronDown className="transition-transform group-data-[state=open]/advanced:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="admin-collapsible">
          <FieldGroup className="pt-4">
            <Field>
              <FieldLabel id="cdn-scheme-label">访问协议</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={value.scheme}
                onValueChange={(value) => {
                  if (value) change('scheme', value as 'https' | 'http')
                }}
                aria-labelledby="cdn-scheme-label"
              >
                <ToggleGroupItem value="https">HTTPS</ToggleGroupItem>
                <ToggleGroupItem value="http">HTTP</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <TextField
              id="cdn-api"
              label="API 地址"
              value={value.apiHost}
              onChange={(value) => change('apiHost', value)}
              placeholder="https://v0.api.upyun.com"
              maxLength={1024}
              description="留空使用又拍云默认地址。"
            />
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
    </ModuleForm>
  )
}
export function BlogSettings({
  section = 'general',
  snapshot,
  account,
}: {
  section?: SettingsSection | 'account'
  snapshot: SettingsSnapshot
  account: { username: string; email: string; avatar: string }
}) {
  const title =
    settingsNav.find((item) => item.id === section)?.label || '基本信息'
  return (
    <>
      <AdminHeading title={title} description="站点设置" />
      <div className="max-w-3xl">
        {section === 'general' ? (
          <General initial={snapshot.general} />
        ) : section === 'appearance' ? (
          <Appearance initial={snapshot.appearance} />
        ) : section === 'content' ? (
          <Content initial={snapshot.content} />
        ) : section === 'social' ? (
          <Social initial={snapshot.social} />
        ) : section === 'interaction' ? (
          <Interaction initial={snapshot.interaction} />
        ) : section === 'storage' ? (
          <Storage initial={snapshot.storage} />
        ) : (
          <AccountSettings
            account={account}
            configured={snapshot.storage.values.configured}
          />
        )}
      </div>
    </>
  )
}
