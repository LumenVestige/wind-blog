import { siteOwner } from '@/server/tenant'
import { resolveStaticFile, serveStaticEntry } from '@/server/blog/static-sites'
import { ApiError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; file?: string[] }> },
) {
  const owner = siteOwner()
  const { slug, file } = await ctx.params
  try {
    const requested = (file || []).join('/')
    if (!requested) return await serveStaticEntry(owner.username, slug)
    const { url } = resolveStaticFile(owner.username, slug, requested)
    return Response.redirect(url, 302)
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 404
    return new Response(e instanceof Error ? e.message : 'not found', { status })
  }
}
