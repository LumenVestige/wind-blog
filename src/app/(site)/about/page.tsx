export const metadata = { title: '关于' }
import Link from 'next/link'
import { siteOwner } from '@/server/tenant'
import { ensureSiteConfig, siteConfigData } from '@/server/blog/site'
import { expandUrl } from '@/server/images'
import { Markdown } from '@/components/blog/markdown'

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  const author = siteOwner()
  const username = author.username
  const cfg = siteConfigData(ensureSiteConfig(author.id))
  const themeId = cfg.themeId
  const name = author.name || username
  const avatar = expandUrl(author.avatar)
  const custom = cfg.aboutMd.trim()

  if (custom) {
    if (themeId === 'chirpy') {
      return (
        <article className="chirpy-article px-1 pt-6">
          <header>
            <h1>关于</h1>
          </header>
          <div className="chirpy-prose">
            <Markdown source={custom} className="" />
          </div>
        </article>
      )
    }
    if (themeId === 'mizuki') {
      return (
        <article className="mz-article">
          <h1>关于</h1>
          <div className="mz-prose">
            <Markdown source={custom} className="" />
          </div>
        </article>
      )
    }
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">关于</h1>
        <Markdown source={custom} />
      </div>
    )
  }

  const portrait = avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt=""
      width={40}
      height={40}
      className={
        themeId === 'mizuki'
          ? 'size-10 shrink-0 rounded-[0.75rem] object-cover'
          : 'size-10 shrink-0 rounded-full object-cover'
      }
      style={
        themeId === 'mizuki'
          ? { boxShadow: '0 0 0 2px var(--mz-btn-bg)' }
          : { boxShadow: 'var(--avatar-border-color) 0 0 0 2px' }
      }
    />
  ) : (
    <div
      className={
        themeId === 'mizuki'
          ? 'flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-[var(--mz-btn-bg)] text-sm font-bold text-[var(--mz-primary)]'
          : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-bg)] text-sm font-bold'
      }
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )

  if (themeId === 'chirpy') {
    return (
      <article className="chirpy-article px-1 pt-6">
        <header>
          <h1>关于</h1>
        </header>
        <div className="mb-4 flex items-center gap-3">
          {portrait}
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[var(--heading-color)]">{name}</p>
            <p className="text-sm text-[var(--text-muted-color)]">@{username}</p>
          </div>
        </div>
        <div className="chirpy-prose">
          {cfg.subtitle ? <p>{cfg.subtitle}</p> : null}
          <p>
            这是 <strong>{name}</strong> 的个人博客。你可以在
            <Link href={`/`}>首页</Link>
            浏览全部文章，或前往
            <Link href="/archives">文章归档</Link>
            看看其他作者。
          </p>
        </div>
      </article>
    )
  }

  if (themeId === 'mizuki') {
    return (
      <article className="mz-article">
        <h1>关于</h1>
        <div className="mb-4 flex items-center gap-3">
          {portrait}
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[var(--mz-text-90)]">{name}</p>
            <p className="text-sm text-[var(--mz-text-50)]">@{username}</p>
          </div>
        </div>
        <div className="mz-prose">
          {cfg.subtitle ? <p>{cfg.subtitle}</p> : null}
          <p>
            这是 <strong>{name}</strong> 的个人博客。你可以在
            <Link href={`/`}>首页</Link>
            浏览全部文章，或前往
            <Link href="/archives">文章归档</Link>
            看看其他作者。
          </p>
        </div>
      </article>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">关于</h1>
      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-12 rounded-full border object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">@{username}</p>
        </div>
      </div>
      {cfg.subtitle ? <p className="text-muted-foreground">{cfg.subtitle}</p> : null}
      <p className="text-sm text-muted-foreground">
        这是 {name} 的个人博客。
        <Link href={`/`} className="text-primary hover:underline">
          返回文章列表
        </Link>
      </p>
    </div>
  )
}
