import { ApiError, ok, requireUser, readJson } from '@/lib/api'
import { getOwner } from '@/server/tenant'
import {
  manageSettingsSnapshot,
  saveManageSettings,
} from '@/server/manage-settings'
import { manageComments } from '@/server/blog/comments'
import type { Handler } from './types'
async function owner(req: Request) {
  const user = await requireUser(req)
  if (user.id !== getOwner()?.id && !user.isAdmin)
    throw new ApiError('只有站长可以管理设置', 1, 403)
  return user
}
export const manageSettingsGetH: Handler = async ({ req }) =>
  ok(manageSettingsSnapshot((await owner(req)).id))
export const manageSettingsSaveH: Handler = async ({ req }) => {
  const user = await owner(req),
    body = await readJson(req)
  return ok(
    saveManageSettings(user.id, body.section, body.values, body.version),
  )
}
export const manageCommentsH: Handler = async ({ req }) => {
  const user = await owner(req),
    query = new URL(req.url).searchParams
  return ok(
    manageComments(user.id, {
      status: query.get('status') || undefined,
      keyword: query.get('keyword') || undefined,
      page: Number(query.get('page')) || 1,
      pageSize: Number(query.get('pageSize')) || 20,
    }),
  )
}
