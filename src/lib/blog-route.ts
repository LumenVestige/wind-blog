const INDEX_ROUTES = new Set(['/', '/archives', '/about', '/categories', '/friends', '/static'])

/** Article slugs occupy exactly one segment; custom pages live under /p/. */
export function isArticlePathname(pathname: string) {
  return /^\/[^/]+$/.test(pathname) && !INDEX_ROUTES.has(pathname)
}
