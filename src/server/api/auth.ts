import { cookieName, secureCookie } from '@/server/http'
import {
  ApiError,
  currentUser,
  fail,
  getQuery,
  handle,
  num,
  ok,
  readJson,
  readForm,
  requireUser,
  str,
} from '@/lib/api'
import { passwordTag, signToken, signingSecret } from '@/lib/jwt'
import {
  authenticate,
  createUser,
  findUserById,
  serializeUser,
} from '@/server/users'
import { hashClientPassword, verifyClientPasswordAsync } from '@/lib/password'
import { isClientPasswordHash } from '@/lib/password'
import { storeAvatarImage } from '@/server/images'
import { activate, ensureSiteConfig } from '@/server/blog/site'
import { isInitialized, siteName } from '@/server/tenant'
import { setSettings } from '@/lib/settings'
import { run, transaction } from '@/db'
import { rateLimit } from '@/server/rate-limit'
import type { Handler } from './types'

function withAuthCookie(res: Response, token: string, req: Request): Response {
  res.headers.append(
    'Set-Cookie',
    `${cookieName('wind_token')}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureCookie(req)}`,
  )
  return res
}

export const login: Handler = async (ctx) => {
  const body = await readJson(ctx.req)
  rateLimit('login:global', 1000)
  rateLimit('login:' + str(body.username).trim().toLowerCase().slice(0, 254), 20)
  const user = await authenticate(str(body.username), str(body.password))
  const token = await signToken({
    id: user.id,
    username: user.username,
    isAdmin: user.is_site_admin === 1,
    passwordTag: passwordTag(user.password),
  })
  ensureSiteConfig(user.id)
  const res = Response.json({
    code: 0,
    success: true,
    message: '登录成功',
    jwtToken: token,
    data: { jwtToken: token, user: serializeUser(user) },
  })
  return withAuthCookie(res, token, ctx.req)
}

/** Single-tenant: registration is only allowed before the site is initialized. */
export const register: Handler = async (ctx) => {
  if (isInitialized()) {
    throw new ApiError('系统已完成初始化，无法再次注册', 1, 403)
  }
  const body = await readJson(ctx.req)
  const password = str(body.password)
  if (!isClientPasswordHash(password)) {
    throw new ApiError('密码需为客户端 SHA-256（64 位十六进制）', 1, 400)
  }
  signingSecret()
  const user = transaction(() => {
    if (isInitialized()) throw new ApiError('系统已完成初始化', 1, 403)
    const user = createUser({
      username: str(body.username),
      email: str(body.email),
      name: str(body.name),
      clientPasswordHash: password,
      isSiteAdmin: true,
    })
    ensureSiteConfig(user.id)
    activate(user.id, { accept: true })
    return user
  })
  const token = await signToken({
    id: user.id,
    username: user.username,
    isAdmin: true,
    passwordTag: passwordTag(user.password),
  })
  const res = Response.json({
    code: 0,
    success: true,
    message: '初始化成功',
    jwtToken: token,
    data: { jwtToken: token, user: serializeUser(user) },
  })
  return withAuthCookie(res, token, ctx.req)
}

export const setupStatus: Handler = async () =>
  ok({ initialized: isInitialized(), siteName: siteName() })

export const setup: Handler = async (ctx) => {
  if (isInitialized()) {
    throw new ApiError('系统已完成初始化', 1, 403)
  }
  const body = await readJson(ctx.req)
  const password = str(body.password)
  if (!isClientPasswordHash(password)) {
    throw new ApiError('密码需为客户端 SHA-256（64 位十六进制）', 1, 400)
  }
  signingSecret()
  const user = transaction(() => {
    if (isInitialized()) throw new ApiError('系统已完成初始化', 1, 403)
    const user = createUser({
      username: str(body.username),
      email: str(body.email),
      name: str(body.name),
      clientPasswordHash: password,
      isSiteAdmin: true,
    })
    ensureSiteConfig(user.id)
    activate(user.id, { accept: true })

    const values: Record<string, string> = {}
    if (str(body.siteName)) values.site_name = str(body.siteName).slice(0, 64)
    const upyun = body.upyun as Record<string, unknown> | undefined
    if (upyun && typeof upyun === 'object') {
      if (upyun.bucket !== undefined) values.upyun_bucket = str(upyun.bucket)
      if (upyun.operator !== undefined) values.upyun_operator = str(upyun.operator)
      if (upyun.password !== undefined) values.upyun_password = str(upyun.password)
      if (upyun.domain !== undefined) values.upyun_domain = str(upyun.domain)
      if (upyun.scheme !== undefined) values.upyun_scheme = str(upyun.scheme)
      if (upyun.apiHost !== undefined) values.upyun_api_host = str(upyun.apiHost)
    }
    if (Object.keys(values).length) setSettings(values)
    return user
  })

  const token = await signToken({ id: user.id, username: user.username, isAdmin: true, passwordTag: passwordTag(user.password) })
  const res = Response.json({
    code: 0,
    success: true,
    message: '初始化成功',
    jwtToken: token,
    data: { jwtToken: token, user: serializeUser(user) },
  })
  return withAuthCookie(res, token, ctx.req)
}

export const logout: Handler = async (ctx) => {
  const res = Response.json({ code: 0, success: true, message: '已退出' })
  res.headers.append(
    'Set-Cookie',
    `${cookieName('wind_token')}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(ctx.req)}`,
  )
  return res
}

export const refresh: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const row = findUserById(user.id)!
  const token = await signToken({
    id: row.id,
    username: row.username,
    isAdmin: row.is_site_admin === 1,
    passwordTag: passwordTag(row.password),
  })
  const res = Response.json({
    code: 0,
    success: true,
    message: '已刷新',
    jwtToken: token,
    data: { jwtToken: token, user: serializeUser(row) },
  })
  return withAuthCookie(res, token, ctx.req)
}

export const changePassword: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const oldHash = str(body.oldPassword)
  const newHash = str(body.newPassword)
  const row = findUserById(user.id)!
  if (!await verifyClientPasswordAsync(row.password, oldHash)) {
    throw new ApiError('原密码错误', 1, 400)
  }
  if (!isClientPasswordHash(newHash)) {
    throw new ApiError('新密码格式不正确', 1, 400)
  }
  run(
    "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
    hashClientPassword(newHash),
    user.id,
  )
  const changed = findUserById(user.id)!
  const token = await signToken({ id: changed.id, username: changed.username, isAdmin: changed.is_site_admin === 1, passwordTag: passwordTag(changed.password) })
  return withAuthCookie(ok({ success: true }), token, ctx.req)
}

export const me: Handler = async (ctx) => {
  const auth = await currentUser(ctx.req)
  if (!auth) return fail('未登录', 401, 401)
  const row = findUserById(auth.id)!
  return ok({
    user: serializeUser(row),
    isAdmin: row.is_site_admin === 1,
    passwordTag: passwordTag(row.password),
  })
}

export const updateProfile: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const body = await readJson(ctx.req)
  const name = body.name !== undefined ? str(body.name).slice(0, 64) : undefined
  const avatar = body.avatar !== undefined ? str(body.avatar).slice(0, 1024) : undefined
  const sets: string[] = []
  const params: unknown[] = []
  if (name !== undefined) {
    sets.push('name = ?')
    params.push(name || user.username)
  }
  if (avatar !== undefined) {
    sets.push('avatar = ?')
    params.push(avatar)
  }
  if (sets.length) {
    params.push(user.id)
    run(
      `UPDATE users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ...params,
    )
  }
  return ok({ user: serializeUser(findUserById(user.id)!) })
}

export const upload: Handler = async (ctx) => {
  const user = await requireUser(ctx.req)
  const form = await readForm(ctx.req, 11 * 1024 * 1024)
  const file = form.get('file')
  if (!(file instanceof File)) throw new ApiError('缺少文件', 1, 400)
  const purpose = str(form.get('purpose') || 'blog')
  const buf = new Uint8Array(await file.arrayBuffer())
  const contentType = file.type || 'application/octet-stream'

  if (purpose === 'avatar') {
    const res = await storeAvatarImage(user.id, buf, contentType)
    run("UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?", res.objectKey, user.id)
    return Response.json({ code: 0, message: 'ok', url: res.url, hash: res.hash, data: { url: res.url, hash: res.hash } })
  }
  // blog | blog_cover
  const { storeBlogImage, isAuthorized } = await import('@/server/images')
  if (!isAuthorized(user.id)) throw new ApiError('未授权图片上传，请先申请', 1, 403)
  const res = await storeBlogImage(user.id, buf, contentType)
  return Response.json({ code: 0, message: 'ok', url: res.url, hash: res.hash, data: { url: res.url, hash: res.hash } })
}

export const notFound: Handler = () => fail('接口不存在', 404, 404)

export { handle, getQuery, num }
