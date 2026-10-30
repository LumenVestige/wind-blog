import Link from '@/components/blog/blog-navigation'

const COMMIT = process.env.NEXT_PUBLIC_GIT_SHA || 'dev'

export function BlogSiteFooter({
  themeId = 'simple',
  displayName,
  username,
  icpNumber = '',
}: {
  themeId?: 'mizuki' | 'chirpy' | 'simple'
  displayName: string
  username?: string
  icpNumber?: string
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
            <span>{COMMIT.slice(0, 7)}</span>
          </p>
          {icpNumber ? <p><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{icpNumber}</a></p> : null}
        </div>
      </footer>
    )
  }

  if (themeId === 'mizuki') {
    return (
      <footer className="mz-footer" aria-label="站点信息">
        <p>
          © {year} <Link href={home}>{displayName}</Link>
          {icpNumber ? (
            <>
              <span className="mx-1.5">·</span>
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{icpNumber}</a>
            </>
          ) : null}
        </p>
      </footer>
    )
  }

  return (
    <footer className="border-t py-6 text-center text-xs text-muted-foreground">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>主题适配自 Wind Blog</span>
        <span aria-hidden>·</span>
        <span>{COMMIT.slice(0, 7)}</span>
        <span aria-hidden>·</span>
        <span>
          © {year} {displayName}
        </span>
      </span>
      {icpNumber ? <p className="mt-1"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">{icpNumber}</a></p> : null}
    </footer>
  )
}
