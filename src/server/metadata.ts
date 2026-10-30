import { headers } from 'next/headers'
import { requestOrigin } from './http'
import { get } from '@/db'
import { getOwner } from './tenant'

/** The configured blog subtitle is also its public search description. */
export function siteDescription(): string {
  const owner = getOwner()
  const config = owner ? get<{ subtitle: string }>('SELECT subtitle FROM blog_site_configs WHERE user_id = ?', owner.id) : undefined
  return config?.subtitle.trim() || '一个独立的个人博客'
}

export async function publicBase(): Promise<URL> {
  const h = await headers()
  return new URL(requestOrigin(new Request(`http://${h.get('host') || 'localhost:3000'}`, { headers: h })))
}
