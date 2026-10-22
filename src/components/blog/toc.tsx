import { extractHeadings } from '@/lib/markdown'

export function Toc({ source }: { source: string }) {
  const headings = extractHeadings(source).filter((h) => h.level <= 3)
  if (headings.length < 3) return null
  return (
    <nav className="mb-6 rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">目录</h3>
      <ul className="space-y-1 text-sm">
        {headings.map((h, i) => (
          <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>
            <a href={`#${h.id}`} className="text-muted-foreground hover:text-primary">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
