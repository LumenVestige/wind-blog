import Link from 'next/link'

const MIZUKI_GITHUB = 'https://github.com/LyraVoid/Mizuki'

export function BlogSiteFooter({
  themeId = 'simple',
  displayName,
  username,
}: {
  themeId?: 'mizuki' | 'chirpy' | 'simple'
  displayName: string
  username?: string
}) {
  const year = new Date().getFullYear()
  const home = username ? `/` : '/'

  if (themeId === 'chirpy') {
    return (
      <footer className="chirpy-footer" aria-label="站点信息">
        <div className="chirpy-footer-inner">
          <p>
            © <time>{year}</time> <Link href={home}>{displayName}</Link>
          </p>
          <p>
            主题 <span title="Chirpy">Chirpy</span>
            <span className="mx-1">·</span>
            <Link href="/">Wind Blog</Link>
            <span className="mx-1">·</span>
            <Link href="/archives">文章归档</Link>
          </p>
        </div>
      </footer>
    )
  }

  if (themeId === 'mizuki') {
    return (
      <footer className="mz-footer" aria-label="站点信息">
        <p>
          © {year} <Link href={home}>{displayName}</Link>
        </p>
        <p className="mz-credit">
          主题适配自{' '}
          <a href={MIZUKI_GITHUB} target="_blank" rel="noopener noreferrer">
            LyraVoid/Mizuki
          </a>
          <span className="mx-1.5">·</span>
          <Link href="/">Wind Blog</Link>
          <span className="mx-1.5">·</span>
          <Link href="/archives">文章归档</Link>
        </p>
      </footer>
    )
  }

  return (
    <footer className="border-t py-6 text-center text-xs text-muted-foreground">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/archives" className="hover:text-foreground">
          文章归档
        </Link>
        <span aria-hidden>·</span>
        <Link href="/" className="hover:text-foreground">
          Wind Blog
        </Link>
        <span aria-hidden>·</span>
        <span>
          © {year} {displayName}
        </span>
      </span>
    </footer>
  )
}
