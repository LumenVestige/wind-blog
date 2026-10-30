/** Package an existing standalone build for Linux x64, without running a compiler on the server. */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { canReuseLinuxNative, nativePackages } from './lib/runtime-native.mjs'
const root = process.cwd(), output = path.resolve(process.argv[2] || 'dist/runtime')
if (output === root || !output.endsWith('/runtime')) throw new Error('输出目录必须以 /runtime 结尾，且不能是项目根目录')
await fs.mkdir(output, { recursive: true })
if ((await fs.readdir(output)).length) throw new Error('输出目录不是空目录，请指定新的输出目录')
const filter = name => { const relative = path.relative(path.join(root, '.next/standalone'), name); return relative !== 'data' && !relative.startsWith('data/') && relative !== '.next/cache' && !relative.startsWith('.next/cache/') && !/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.DS_Store|\._[^/]*)(?:\/|$)/.test(relative) && !/\.db(?:-wal|-shm)?$/.test(name) }
await fs.cp(path.join(root, '.next/standalone'), output, { recursive: true, filter })
await fs.cp(path.join(root, '.next/static'), path.join(output, '.next/static'), { recursive: true })
await fs.mkdir(path.join(output, 'src/db'), { recursive: true })
await fs.copyFile(path.join(root, 'src/db/schema.sql'), path.join(output, 'src/db/schema.sql'))
await fs.mkdir(path.join(output, 'scripts'), { recursive: true })
await fs.copyFile(path.join(root, 'scripts/reset-password.mjs'), path.join(output, 'scripts/reset-password.mjs'))
await fs.copyFile(path.join(root, 'deploy/Dockerfile.runtime'), path.join(output, 'Dockerfile'))
try { await fs.cp(path.join(root, 'public'), path.join(output, 'public'), { recursive: true }) } catch (e) { if (e.code !== 'ENOENT') throw e }
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'))
const img = path.join(output, 'node_modules/@img')
try { for (const entry of await fs.readdir(img)) if (!entry.includes('linux-x64')) await fs.rm(path.join(img, entry), { recursive: true, force: true }) } catch (e) { if (e.code !== 'ENOENT') throw e }
// GitHub's Linux runner already installed the lockfile-verified native modules.
// Cross-platform packaging still downloads and checks the Linux distributions.
if (await canReuseLinuxNative(output, lock)) {
  console.log('Reusing installed Linux x64 native dependencies')
} else {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wind-linux-native-'))
  try {
    for (const name of nativePackages) {
      const meta = lock.packages[`node_modules/${name}`]
      if (!meta?.resolved?.startsWith('https://registry.npmjs.org/')) throw new Error('缺少可信 npm 下载地址')
      const res = await fetch(meta.resolved)
      if (!res.ok) throw new Error(`下载 ${name} 失败：${res.status}`)
      const bytes = Buffer.from(await res.arrayBuffer())
      const [algo, expected] = meta.integrity.split('-')
      if (createHash(algo).update(bytes).digest('base64') !== expected) throw new Error(`${name} 校验失败`)
      const archive = path.join(tmp, name.split('/')[1] + '.tgz'), dest = path.join(output, 'node_modules', name)
      await fs.writeFile(archive, bytes); await fs.mkdir(dest, { recursive: true })
      execFileSync('tar', ['-xzf', archive, '-C', dest, '--strip-components=1'])
    }
  } finally { await fs.rm(tmp, { recursive: true, force: true }) }
}
console.log(`Linux x64 runtime ready: ${output}`)
