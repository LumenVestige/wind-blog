'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, LogOut, PenSquare, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, setToken } from '@/lib/api-client'

interface Me {
  user: { id: number; username: string; name: string; avatar: string }
  isAdmin: boolean
}

export function SiteHeader() {
  const [me, setMe] = useState<Me | null>(null)
  const [siteName, setSiteName] = useState('Wind Blog')
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    api
      .get<{ initialized: boolean; siteName: string }>('/api/setup/status')
      .then((r) => r.siteName && setSiteName(r.siteName))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    api
      .get<Me>('/api/user/profile/me')
      .then((r) => active && setMe(r))
      .catch(() => active && setMe(null))
      .finally(() => active && setReady(true))
    return () => {
      active = false
    }
  }, [pathname])

  async function logout() {
    try {
      await api.post('/api/user/auth/logout')
    } catch {
      return
    }
    setToken('')
    setMe(null)
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-primary" />
          {siteName}
        </Link>
        <nav className="flex items-center gap-2">
          {ready && me ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/manage/new`}>
                  <PenSquare className="h-4 w-4" />
                  写作
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {me.user.name || me.user.username}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/`}>我的博客</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/manage`}>
                      <PenSquare className="h-4 w-4" />
                      博客管理
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/manage/settings`}>
                      <Settings className="h-4 w-4" />
                      外观
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : ready ? (
            <Button asChild size="sm">
              <Link href="/login">登录</Link>
            </Button>
          ) : null}
        </nav>
      </div>
    </header>
  )
}
