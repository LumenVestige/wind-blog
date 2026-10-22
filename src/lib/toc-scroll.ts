/** Recenter near an outline edge, without scrolling the article or ancestors. */
export function scrollTocItemIntoView(
  container: HTMLElement,
  item: HTMLElement,
  scroll: (top: number) => void = (top) => { container.scrollTop = top },
) {
  if (
    container.clientHeight === 0 ||
    container.scrollHeight <= container.clientHeight
  )
    return
  const viewport = container.getBoundingClientRect()
  const entry = item.getBoundingClientRect()
  const top = viewport.top + container.clientTop
  const bottom = top + container.clientHeight
  const margin = Math.min(120, container.clientHeight / 4)
  if (entry.top >= top + margin && entry.bottom <= bottom - margin) return

  const target =
    container.scrollTop + (entry.top + entry.bottom) / 2 - (top + bottom) / 2
  scroll(Math.min(
    container.scrollHeight - container.clientHeight,
    Math.max(0, target),
  ))
}

/** The section crossing the reading line, plus headings visible below it. */
export function readingHeadingIds(
  headings: { id: string; top: number }[],
  offset: number,
  bottom: number,
  atEnd = false,
) {
  if (headings.length === 0) return null
  let active = headings[0]
  for (const heading of headings) {
    if (heading.top <= offset) active = heading
  }
  if (atEnd) active = headings[headings.length - 1]
  const ids = headings
    .filter(
      (heading) =>
        heading.id === active.id ||
        (heading.top > offset && heading.top < bottom),
    )
    .map((heading) => heading.id)
  return { activeId: active.id, ids }
}
