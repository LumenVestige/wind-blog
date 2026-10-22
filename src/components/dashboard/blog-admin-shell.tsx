'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  PenLine,
  Wind,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { api } from '@/lib/api-client'
import { confirmUnsavedNavigation } from '@/lib/use-draft'
import { adminLocation, adminNav, adminNavActive } from '@/lib/admin-nav'
import { AdminPageMotion } from './admin-page-motion'

function Navigation() {
  const pathname = usePathname(),
    params = useSearchParams()
  const { setOpenMobile, state, setOpen } = useSidebar()
  const current = pathname + (params.toString() ? `?${params}` : '')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    内容管理: true,
    站点设置: pathname.startsWith('/manage/settings'),
    访客与数据: false,
  })
  useEffect(() => {
    for (const group of adminNav)
      if (
        'items' in group &&
        group.items.some((item) =>
          adminNavActive(item.href, pathname, params.toString()),
        )
      )
        setExpanded({ [group.label]: true })
  }, [current])
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {adminNav.map((group) =>
            'href' in group ? (
              <SidebarMenuItem key={group.label}>
                <SidebarMenuButton
                  asChild
                  tooltip={group.label}
                  isActive={adminNavActive(
                    group.href,
                    pathname,
                    params.toString(),
                  )}
                >
                  <Link href={group.href} onClick={() => setOpenMobile(false)}>
                    <group.icon />
                    <span>{group.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <Collapsible
                key={group.label}
                asChild
                open={!!expanded[group.label]}
                onOpenChange={(open) =>
                  setExpanded({
                    [group.label]: state === 'collapsed' ? true : open,
                  })
                }
                className="group/nav"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={group.label}
                      onClick={() => {
                        if (state === 'collapsed') setOpen(true)
                      }}
                    >
                      <group.icon />
                      <span>{group.label}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/nav:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="admin-collapsible">
                    <SidebarMenuSub>
                      {group.items.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={adminNavActive(
                              item.href,
                              pathname,
                              params.toString(),
                            )}
                          >
                            <Link
                              href={item.href}
                              aria-current={
                                adminNavActive(
                                  item.href,
                                  pathname,
                                  params.toString(),
                                )
                                  ? 'page'
                                  : undefined
                              }
                              onClick={() => setOpenMobile(false)}
                            >
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
function OwnerMenu({
  username,
  displayName,
}: {
  username: string
  displayName: string
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false)
  async function logout() {
    if (!confirmUnsavedNavigation()) return
    setBusy(true)
    try {
      await api.post('/api/user/auth/logout')
      router.replace('/login')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '退出失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {displayName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  @{username}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="min-w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/manage/settings/account">账号安全</Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={() => void logout()}>
                <LogOut />
                {busy ? '正在退出…' : '退出登录'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
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
  const pathname = usePathname(),
    params = useSearchParams(),
    location = adminLocation(pathname, params.toString())
  return (
    <SidebarProvider data-blog-admin="1">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-3"
      >
        跳到主要内容
      </a>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/manage">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Wind />
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="font-semibold">Wind Blog</span>
                    <span className="text-xs text-muted-foreground">
                      站点管理
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <Navigation />
        </SidebarContent>
        <SidebarFooter>
          <OwnerMenu username={username} displayName={displayName} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {location.group && (
                <>
                  <BreadcrumbItem className="hidden sm:block">
                    {location.group}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{location.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                查看博客
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
            {pathname !== '/manage/new' &&
              !pathname.startsWith('/manage/edit/') && (
                <Button size="sm" asChild>
                  <Link href="/manage/new">
                    <PenLine data-icon="inline-start" />
                    写文章
                  </Link>
                </Button>
              )}
          </div>
        </header>
        <div
          id="admin-content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col p-4 outline-none md:p-6 lg:p-8"
        >
          <AdminPageMotion>{children}</AdminPageMotion>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
