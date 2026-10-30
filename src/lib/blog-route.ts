const INDEX_ROUTES = new Set(['/', '/archives', '/about', '/categories', '/friends', '/static'])
const RESERVED_ROUTES = new Set(['manage', 'dashboard', 'login', 'register', 'setup', 'api', 'user', '_next', 'blog', 'blog-plaza'])

export function isBlogPathname(pathname: string) {
  if (INDEX_ROUTES.has(pathname) || /^\/p\/[^/]+$/.test(pathname)) return true
  return /^\/[^/]+$/.test(pathname) && !RESERVED_ROUTES.has(pathname.slice(1))
}

/** Article slugs occupy exactly one segment; custom pages live under /p/. */
export function isArticlePathname(pathname: string) {
  return /^\/[^/]+$/.test(pathname) && !INDEX_ROUTES.has(pathname)
}
