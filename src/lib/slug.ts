import crypto from 'node:crypto'

/** Keep ASCII letters and digits from a title. CJK and punctuation become separators, matching the old site. */
export function slugify(input: string): string {
  const s = (input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '')
  return s || 'post'
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

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function randomSlugSuffix(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('')
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
