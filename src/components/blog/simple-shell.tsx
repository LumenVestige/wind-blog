'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Settings } from 'lucide-react'
import { ThemeInit, ThemeToggle } from './theme-toggle'
import { BlogSiteFooter } from './site-footer'
import { SocialIcon, socialAriaLabel } from './social-icon'
import { cn } from '@/lib/utils'
import type { BlogShellData } from './shell-types'

export function SimpleShell({
  data,
  scheme,
  children,
}: {
  data: BlogShellData
  scheme: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const base = ''

  const items = [
    { href: '/', label: '文章', end: true },
    { href: `${base}/categories`, label: '分类' },
    { href: `${base}/archives`, label: '归档' },
    { href: `${base}/static`, label: '静态页' },
    ...(data.showFriends ? [{ href: `${base}/friends`, label: '友链' }] : []),
    { href: `${base}/about`, label: '关于' },
    ...data.pages.map((p) => ({ href: `${base}/p/${p.slug}`, label: p.label })),
  ]

  function isActive(href: string, end?: boolean) {
    return end ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div data-blog-theme="simple" className="flex min-h-screen flex-col bg-background text-foreground">
      <ThemeInit scheme={scheme} />
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
            <BookOpen className="size-4 shrink-0 text-primary" />
            <span className="truncate">{data.siteName}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle variant="cycle" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" />
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive(it.href, (it as { end?: boolean }).end)
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {it.label}
              </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      {data.socialLinks.length > 0 && <nav aria-label="社交链接" className="mx-auto flex flex-wrap justify-center gap-4 py-4">{data.socialLinks.map((link, i) => <a key={i} href={link.url} aria-label={socialAriaLabel(link)} title={link.label || link.type} target="_blank" rel="noreferrer"><SocialIcon type={link.type} /></a>)}</nav>}
      <BlogSiteFooter themeId="simple" displayName={data.displayName} username={data.username} icpNumber={data.icpNumber} />
    </div>
  )
}
