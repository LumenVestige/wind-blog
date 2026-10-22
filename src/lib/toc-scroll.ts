/** Reveal the active entry inside the outline without scrolling any ancestors. */
export function scrollTocItemIntoView(
  container: HTMLElement,
  item: HTMLElement,
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
  if (entry.top < top) container.scrollTop += entry.top - top
  else if (entry.bottom > bottom) container.scrollTop += entry.bottom - bottom
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
