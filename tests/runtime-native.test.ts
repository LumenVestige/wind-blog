import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { canReuseLinuxNative, nativePackages } from '../scripts/lib/runtime-native.mjs'

let directory: string
const linux = { platform: 'linux' as const, arch: 'x64' as const, glibc: '2.36' }
const lock = { packages: Object.fromEntries(nativePackages.map(name => [`node_modules/${name}`, { version: '1.2.3' }])) }

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wind-native-reuse-'))
  for (const name of nativePackages) {
    const root = path.join(directory, 'node_modules', name)
    await fs.mkdir(path.join(root, 'lib'), { recursive: true })
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }))
    await fs.writeFile(path.join(root, 'lib', name.includes('libvips') ? 'libvips-cpp.so.8' : 'sharp-linux-x64.node'), 'binary fixture')
  }
})
afterEach(() => fs.rm(directory, { recursive: true, force: true }))

describe('Linux runtime native dependency reuse', () => {
  it('reuses complete matching packages on Linux x64 glibc', async () => {
    expect(await canReuseLinuxNative(directory, lock, linux)).toBe(true)
  })
  it('keeps cross-platform and musl packaging on the verified download path', async () => {
    expect(await canReuseLinuxNative(directory, lock, { ...linux, platform: 'darwin' })).toBe(false)
    expect(await canReuseLinuxNative(directory, lock, { ...linux, arch: 'arm64' })).toBe(false)
    expect(await canReuseLinuxNative(directory, lock, { ...linux, glibc: '' })).toBe(false)
  })
  it('rejects missing binaries or package versions that differ from the lockfile', async () => {
    const root = path.join(directory, 'node_modules', nativePackages[0])
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }))
    expect(await canReuseLinuxNative(directory, lock, linux)).toBe(false)
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }))
    await fs.unlink(path.join(root, 'lib/sharp-linux-x64.node'))
    expect(await canReuseLinuxNative(directory, lock, linux)).toBe(false)
  })
})
