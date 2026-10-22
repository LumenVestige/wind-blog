export function extractMarkdownCodeText(block: Element): string {
  const srcs = block.querySelectorAll('.md-code-src')
  if (srcs.length > 0) {
    return Array.from(srcs, (el) => {
      const raw = el.getAttribute('data-copy-text')
      if (raw != null && raw !== '') return raw
      return el.textContent ?? ''
    }).join('\n')
  }
  const pre = block.querySelector('pre')
  if (pre) {
    const clone = pre.cloneNode(true) as Element
    clone.querySelectorAll('.md-code-ln').forEach((n) => n.remove())
    return (clone.textContent ?? '').replace(/\n$/, '')
  }
  return ''
}

