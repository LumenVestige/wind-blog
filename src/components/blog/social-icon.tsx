import { Github, Globe, Link2, Mail, Rss, Twitter } from 'lucide-react'
import type { ShellSocialLink } from './shell-types'

export function SocialIcon({ type }: { type: string }) {
  const t = (type || '').toLowerCase()
  if (t.includes('github')) return <Github className="size-4" />
  if (t.includes('twitter') || t === 'x') return <Twitter className="size-4" />
  if (t.includes('mail') || t.includes('email')) return <Mail className="size-4" />
  if (t.includes('rss')) return <Rss className="size-4" />
  if (t.includes('web') || t.includes('site') || t.includes('blog')) return <Globe className="size-4" />
  return <Link2 className="size-4" />
}

export function socialAriaLabel(link: ShellSocialLink): string {
  return link.label || link.type
}
