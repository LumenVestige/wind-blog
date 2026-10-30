import { notFound, redirect } from 'next/navigation'
import { siteOwner } from '@/server/tenant'
import { navigationArticles } from '@/server/blog/navigation'

export const metadata = { title: '友链' }
export const dynamic = 'force-dynamic'

/** Compatibility entry only; content lives in an ordinary link-only article. */
export default function Page() {
  const article = navigationArticles(siteOwner().id).friends
  if (!article) notFound()
  redirect(`/${article.slug}`)
}
