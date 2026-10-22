import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Old plugin and bookmark links use /blog/:username/...
 * The site itself is served at /. This only forwards.
 */
export default async function LegacyBlogPath({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { path = [] } = await params
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') q.set(key, value)
    else if (Array.isArray(value)) for (const item of value) q.append(key, item)
  }
  const rest = path.slice(1).map(encodeURIComponent)
  let target = '/'
  if (rest[0] === 'manage') {
    target = rest.length > 1 ? `/manage/${rest.slice(1).join('/')}` : '/manage'
  } else if (rest[0] === 'static') {
    target = rest.length > 1 ? `/static/${rest.slice(1).join('/')}` : '/static'
  } else if (rest.length) {
    target = `/${rest.join('/')}`
  }
  const qs = q.toString()
  redirect(qs ? `${target}?${qs}` : target)
}
