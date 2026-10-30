import { currentUser, ok } from '@/lib/api'
import { blogPageData } from '@/server/blog/page-data'
import type { Handler } from './types'

/** Browser navigation returns an ordinary JSON envelope, never an RSC stream. */
export const blogPageH: Handler = async ({ req, query }) =>
  ok(blogPageData(query.get('href') || '/', { viewer: await currentUser(req), req }))
