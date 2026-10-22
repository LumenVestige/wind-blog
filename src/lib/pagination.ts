export const PAGE_SIZES = [10, 20, 50, 100] as const

export function parsePageSize(value: unknown, fallback = 10): number {
  const size = Number(value)
  return (PAGE_SIZES as readonly number[]).includes(size) ? size : fallback
}

export function parsePage(value: unknown): number {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

/** Keep the ends and a stable reading window without single-page gaps. */
export function paginationItems(
  page: number,
  pages: number,
): (number | 'start-gap' | 'end-gap')[] {
  if (pages <= 8) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = page <= 4 ? 1 : page >= pages - 3 ? pages - 5 : page - 2
  const end = page <= 4 ? 6 : page >= pages - 3 ? pages : page + 2
  const items: (number | 'start-gap' | 'end-gap')[] = []
  if (start > 1) items.push(1)
  if (start === 3) items.push(2)
  else if (start > 3) items.push('start-gap')
  for (let i = start; i <= end; i++) items.push(i)
  if (end === pages - 2) items.push(pages - 1)
  else if (end < pages - 2) items.push('end-gap')
  if (end < pages) items.push(pages)
  return items
}
