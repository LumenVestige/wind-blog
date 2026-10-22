export function formatDateSlash(sec?: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

export function formatDateLong(sec?: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN')
}

export function blogQuery(
  username: string,
  query: Record<string, string | number | undefined>,
): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === '' || v === 0) continue
    q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `/?${s}` : `/`
}

export function estimateReadMinutes(content?: string): number {
  if (!content) return 1
  const text = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#>*_\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const words = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.ceil(cjk / 300 + words / 200))
}
