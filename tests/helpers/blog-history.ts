import { vi } from 'vitest'

/** Linkedom has no History implementation. Keep real URL semantics in router tests. */
export function installBlogHistory() {
  const entries: { url: string; state: Record<string, unknown> }[] = [{ url: location.href, state: {} }]
  let index = 0
  const history = {
    state: entries[0].state,
    scrollRestoration: 'auto',
    pushState: vi.fn((state: Record<string, unknown>, _title: string, url?: string | URL | null) => {
      if (url) location.href = new URL(url, location.href).href
      entries.splice(index + 1)
      entries.push({ url: location.href, state })
      index++
      history.state = state
    }),
    replaceState: vi.fn((state: Record<string, unknown>, _title: string, url?: string | URL | null) => {
      if (url) location.href = new URL(url, location.href).href
      history.state = state
      entries[index] = { url: location.href, state }
    }),
    go(delta: number) {
      index += delta
      location.href = entries[index].url
      history.state = entries[index].state
      const event = new Event('popstate')
      Object.defineProperty(event, 'state', { value: history.state })
      window.dispatchEvent(event)
    },
  }
  vi.stubGlobal('history', history)
  vi.stubGlobal('scrollTo', vi.fn())
  return history
}
