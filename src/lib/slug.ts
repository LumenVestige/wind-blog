/** Slugify a title into lowercase letters/digits/hyphens. CJK is kept for explicit titles. */
export function slugify(input: string): string {
  const s = (input || '')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return s.slice(0, 96).replace(/-+$/, '') || 'post'
}

/** Public article path. ASCII slugs stay readable; anything else is percent-encoded and breaks plugin links. */
export function isAsciiSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

/** Validate a user-supplied slug (lowercase letters, digits, hyphen). */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/.test(slug)
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_-]{3,64}$/.test(username)
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Ensure a slug is unique for a user by appending -2, -3, ... */
export function uniqueSlug(
  base: string,
  exists: (slug: string) => boolean,
): string {
  let candidate = base
  let n = 2
  while (exists(candidate)) {
    candidate = `${base}-${n}`
    n += 1
  }
  return candidate
}
