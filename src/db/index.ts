import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

let _db: DatabaseSync | null = null
let transactionDepth = 0

export function dbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'data', 'wind-blog.db')
}

function schemaSql(): string {
  const p = path.join(process.cwd(), 'src', 'db', 'schema.sql')
  return fs.readFileSync(p, 'utf8')
}

/** Open (once) and initialize the SQLite database. */
export function getDb(): DatabaseSync {
  if (_db) return _db
  const p = dbPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const db = new DatabaseSync(p)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec('PRAGMA busy_timeout = 5000;')
  db.exec(schemaSql())
  ensureDefaultSettings(db)
  _db = db
  return db
}

/** For tests / scripts: close the singleton so a fresh DB_PATH can be opened. */
export function closeDb(): void {
  if (_db) {
    try {
      _db.close()
    } catch {
      /* ignore */
    }
    _db = null
  }
}

export type Row = Record<string, unknown>

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[]
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as never[])) as T | undefined
}

export function run(
  sql: string,
  ...params: unknown[]
): { changes: number; lastInsertRowid: number } {
  const r = getDb().prepare(sql).run(...(params as never[]))
  return {
    changes: Number(r.changes),
    lastInsertRowid: Number(r.lastInsertRowid),
  }
}

/** Run a function inside a transaction; rolls back on throw. */
export function transaction<T>(fn: () => T): T {
  const db = getDb()
  const depth = transactionDepth
  const savepoint = `wind_tx_${depth}`
  db.exec(depth ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE')
  transactionDepth += 1
  try {
    const out = fn()
    db.exec(depth ? `RELEASE ${savepoint}` : 'COMMIT')
    return out
  } catch (e) {
    db.exec(depth ? `ROLLBACK TO ${savepoint}` : 'ROLLBACK')
    if (depth) db.exec(`RELEASE ${savepoint}`)
    throw e
  } finally { transactionDepth -= 1 }
}

export function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === '1' || v === 'true'
}

export function fromBool(v: boolean): number {
  return v ? 1 : 0
}

export function parseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== 'string' || !s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: 'Wind Blog',
  favicon_url: '',
  icp_number: '',
  upyun_bucket: '',
  upyun_operator: '',
  upyun_password: '',
  upyun_domain: '',
  upyun_scheme: 'https',
  upyun_api_host: '',
  upyun_upload_dir: 'blog',
  image_upload_default_enabled: '1',
  obsidian_publish_token: process.env.CWXU_OBSIDIAN_PUBLISH_TOKEN || '',
  plugin_download_base: '',
  agreement_version: 'v1-cn-2026',
  agreement_title: 'Wind Blog 开通协议',
  agreement_content:
    '欢迎使用 Wind Blog。开通博客即表示你同意：发布内容真实合法，不侵犯他人权益；平台可对违规内容进行下架处理。',
}

function ensureDefaultSettings(db: DatabaseSync): void {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)',
  )
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    stmt.run(k, v)
  }
}

export { DEFAULT_SETTINGS }
