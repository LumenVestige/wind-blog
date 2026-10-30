'use client'

import { api } from '@/lib/api-client'
import type { BlogPageResponse } from '@/lib/blog-page'

const pages = new Map<string, { expires: number; request: Promise<BlogPageResponse> }>()
const TTL = 30_000

/** Hover and click share one JSON request. A traversal/refresh always rechecks the server. */
export function loadBlogPage(href: string, fresh = false): Promise<BlogPageResponse> {
  const url = new URL(href, window.location.href)
  const key = url.pathname + url.search
  const cached = pages.get(key)
  if (!fresh && cached && cached.expires > Date.now()) return cached.request
  const request = api.get<BlogPageResponse>('/api/blog/page', { href: key })
  const entry = { expires: Date.now() + TTL, request }
  pages.set(key, entry)
  while (pages.size > 12) pages.delete(pages.keys().next().value!)
  void request.catch(() => { if (pages.get(key) === entry) pages.delete(key) })
  return request
}

export function forgetBlogPage(href: string) {
  const url = new URL(href, window.location.href)
  pages.delete(url.pathname + url.search)
}
