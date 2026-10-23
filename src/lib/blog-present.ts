export function formatDateSlash(sec?: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

export function formatDateCn(sec?: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatDateLong(sec?: number): string {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN')
}

export type BlogQueryValue = string | number | undefined | readonly (string | number)[]

export function blogQuery(
  username: string,
  query: Record<string, BlogQueryValue>,
): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    // Arrays become repeated params (`?categoryId=1&categoryId=2`).
    for (const item of Array.isArray(v) ? v : [v]) {
      if (item === undefined || item === '' || item === 0) continue
      q.append(k, String(item))
    }
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
