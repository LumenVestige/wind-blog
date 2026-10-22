import { get, run } from '@/db'
import { hashClientPassword, verifyClientPasswordAsync } from '@/lib/password'
import { isValidEmail, isValidUsername } from '@/lib/slug'
import { ApiError } from '@/lib/api'
import { isoToUnix } from '@/lib/utils'

export interface UserRow {
  id: number
  username: string
  password: string
  name: string
  email: string
  avatar: string
  is_site_admin: number
  created_at: string
  updated_at: string
}

export interface UserPublic {
  id: number
  username: string
  name: string
  avatar: string
  createdAt: number
}

export function findUserById(id: number): UserRow | undefined {
  return get<UserRow>('SELECT * FROM users WHERE id = ?', id)
}

export function findUserByUsername(username: string): UserRow | undefined {
  return get<UserRow>(
    'SELECT * FROM users WHERE username = ? COLLATE NOCASE',
    (username || '').trim(),
  )
}

export function findUserByEmail(email: string): UserRow | undefined {
  return get<UserRow>(
    'SELECT * FROM users WHERE email = ?',
    (email || '').trim().toLowerCase(),
  )
}

/** Login accepts username or email. */
export function findUserByLogin(login: string): UserRow | undefined {
  const v = (login || '').trim()
  if (v.includes('@')) return findUserByEmail(v)
  return findUserByUsername(v)
}

export function serializeUser(u: {
  id: number
  username: string
  name: string
  avatar: string
  created_at?: string
}): UserPublic {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    createdAt: isoToUnix(u.created_at),
  }
}

export interface CreateUserInput {
  username: string
  email: string
  name?: string
  /** Client SHA-256 hash */
  clientPasswordHash: string
  avatar?: string
  isSiteAdmin?: boolean
}

export function createUser(input: CreateUserInput): UserRow {
  const username = (input.username || '').trim()
  const email = (input.email || '').trim().toLowerCase()
  if (!isValidUsername(username)) {
    throw new ApiError('用户名需为 3–64 位字母、数字、下划线或短横线', 1, 400)
  }
  if (!isValidEmail(email)) {
    throw new ApiError('邮箱格式不正确', 1, 400)
  }
  if (findUserByUsername(username)) throw new ApiError('用户名已被占用', 1, 400)
  if (findUserByEmail(email)) throw new ApiError('邮箱已被注册', 1, 400)
  const hash = hashClientPassword(input.clientPasswordHash)
  const { lastInsertRowid } = run(
    `INSERT INTO users (username, password, name, email, avatar, is_site_admin)
     VALUES (?, ?, ?, ?, ?, ?)`,
    username,
    hash,
    (input.name || username).slice(0, 64),
    email,
    input.avatar || '',
    input.isSiteAdmin ? 1 : 0,
  )
  return findUserById(lastInsertRowid)!
}

export async function authenticate(
  login: string,
  clientPasswordHash: string,
): Promise<UserRow> {
  const user = findUserByLogin(login)
  if (!user) throw new ApiError('用户名或密码错误', 1, 400)
  if (!await verifyClientPasswordAsync(user.password, clientPasswordHash)) {
    throw new ApiError('用户名或密码错误', 1, 400)
  }
  return user
}
