// Run as root in a Node container with /root/blog mounted at /deployment.
import fs from 'node:fs'
import { randomBytes } from 'node:crypto'
const base = process.argv[2] || '/deployment'
for (const name of ['sec', 'syc']) {
  const dir = `${base}/${name}`
  fs.mkdirSync(`${dir}/data`, { recursive: true })
  fs.chownSync(`${dir}/data`, 1000, 1000); fs.chmodSync(`${dir}/data`, 0o700)
  const file = `${dir}/.env`
  if (!fs.existsSync(file)) fs.writeFileSync(file, `JWT_SECRET=${randomBytes(48).toString('hex')}\nINSTANCE_ID=${name}\nTRUST_PROXY=1\nDB_PATH=/data/wind-blog.db\nNODE_ENV=production\n`, { mode: 0o600, flag: 'wx' })
}
if (!fs.existsSync(`${base}/.env`)) fs.writeFileSync(`${base}/.env`, 'WIND_BLOG_IMAGE=wind-blog:release-20261022-ux\n', { mode: 0o600, flag: 'wx' })
fs.copyFileSync(`${base}/app/deploy/compose.yaml`, `${base}/compose.yaml`)
console.log('sec/syc prepared with independent keys, databases and cookies; setup remains uninitialized.')
