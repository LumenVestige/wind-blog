import Link from 'next/link'

export function BlogNav({
  username,
  pages,
  staticSites,
  aboutMd,
}: {
  username: string
  pages: { slug: string; label: string }[]
  staticSites: { slug: string; label: string }[]
  aboutMd: boolean
}) {
  return (
    <nav className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <Link href={`/`} className="text-muted-foreground hover:text-primary">
        首页
      </Link>
      <Link href={`/categories`} className="text-muted-foreground hover:text-primary">
        分类
      </Link>
      <Link href={`/archives`} className="text-muted-foreground hover:text-primary">
        归档
      </Link>
      <Link href={`/static`} className="text-muted-foreground hover:text-primary">
        静态页
      </Link>
      {aboutMd && (
        <Link href={`/about`} className="text-muted-foreground hover:text-primary">
          关于
        </Link>
      )}
      <Link href={`/friends`} className="text-muted-foreground hover:text-primary">
        友链
      </Link>
      {pages.map((p) => (
        <Link
          key={p.slug}
          href={`/p/${p.slug}`}
          className="text-muted-foreground hover:text-primary"
        >
          {p.label}
        </Link>
      ))}

    </nav>
  )
}
