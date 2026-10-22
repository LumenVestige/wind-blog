import { getDb, dbPath } from './index'

getDb()
// eslint-disable-next-line no-console
console.log(`[wind-blog] schema applied at ${dbPath()}`)
