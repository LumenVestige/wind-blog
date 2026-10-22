'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { confirmUnsavedNavigation } from '@/lib/use-draft'
import { api } from '@/lib/api-client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  FileCode,
  FolderOpen,
  LayoutList,
  PenLine,
  Pin,
  Settings, MessageSquare, LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Item = {
  href: string
  label: string
  icon: typeof LayoutList
  end?: boolean
  also?: string[]
}

export function BlogAdminShell({
  username,
  displayName,
  children,
}: {
  username: string
  displayName: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  async function logout() { if (!confirmUnsavedNavigation()) return; setLoggingOut(true); try { await api.post('/api/user/auth/logout'); router.replace('/login'); router.refresh() } catch (e) { toast.error(e instanceof Error ? e.message : '退出失败') } finally { setLoggingOut(false) } }
  const groups: { label: string; items: Item[] }[] = [
    {
      label: '内容',
      items: [
        { href: '/manage', label: '文章', icon: LayoutList, end: true },
        { href: '/manage/new', label: '写文章', icon: PenLine, also: ['/manage/edit'] },
        { href: '/manage/pinned', label: '置顶', icon: Pin },
        { href: '/manage/categories', label: '分类', icon: FolderOpen },
        { href: '/manage/static', label: '页面', icon: FileCode },
        { href: '/manage/comments', label: '留言审核', icon: MessageSquare },
        { href: '/manage/analytics', label: '数据', icon: BarChart3 },
      ],
    },
    {
      label: '站点',
      items: [
        { href: '/manage/settings', label: '设置', icon: Settings },
      ],
    },
  ]
  const flat = groups.flatMap((g) => g.items)

  function active(item: Item) {
    if (item.also?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return true
    }
    if (item.end) return pathname === item.href
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  return (
    <div className="min-h-svh bg-muted/30 text-foreground md:grid md:grid-cols-[15rem_1fr]" data-blog-admin="1">
      <aside className="sticky top-0 hidden h-svh border-r bg-background md:flex md:flex-col">
        <div className="border-b px-4 py-4">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">@{username}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-5 px-3 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.href} item={item} on={active(item)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t p-3">
          <Button variant="ghost" className="w-full justify-start" disabled={loggingOut} onClick={() => void logout()}><LogOut className="size-3.5" />退出登录</Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/">
              <ArrowLeft className="size-3.5" />
              打开博客
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur md:hidden">
          <div className="flex h-12 items-center gap-2 px-3">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{displayName}</p>
            <Button variant="ghost" size="sm" disabled={loggingOut} onClick={() => void logout()}>退出登录</Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/">博客</Link>
            </Button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {flat.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm',
                  active(item) ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  )
}

function NavItem({ item, on }: { item: Item; on: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
        on ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  )
}
