import fs from 'node:fs/promises'
import path from 'node:path'

export const nativePackages = ['@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64']

/** Reuse only complete, lockfile-matching Linux glibc binaries. */
export async function canReuseLinuxNative(output, lock, runtime = {
  platform: process.platform,
  arch: process.arch,
  glibc: process.platform === 'linux' ? process.report.getReport().header.glibcVersionRuntime : '',
}) {
  if (runtime.platform !== 'linux' || runtime.arch !== 'x64' || !runtime.glibc) return false
  return (await Promise.all(nativePackages.map(async name => {
    try {
      const directory = path.join(output, 'node_modules', name)
      const meta = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'))
      if (meta.version !== lock.packages[`node_modules/${name}`]?.version) return false
      const files = await fs.readdir(path.join(directory, 'lib'))
      const binary = files.find(file => name.includes('libvips') ? file.startsWith('libvips-cpp.so') : file.endsWith('.node'))
      return !!binary && (await fs.stat(path.join(directory, 'lib', binary))).size > 0
    } catch (error) { if (error.code === 'ENOENT') return false; throw error }
  }))).every(Boolean)
}
