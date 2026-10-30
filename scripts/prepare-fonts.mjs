import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

async function prepare(packageName, directory, styles, licenses, output = 'style.css', transform = css => css) {
  const source = path.join(root, 'node_modules', packageName)
  const { version } = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'))
  const destination = path.join(root, 'public/fonts', directory, version)
  await fs.mkdir(path.join(destination, 'files'), { recursive: true })
  const sheets = []
  for (const name of styles) {
    // WOFF2 only; preserve unicode-range so browsers fetch matching subsets.
    const css = transform((await fs.readFile(path.join(source, name), 'utf8'))
      .replace(/,\s*url\([^)]+\.woff\) format\('woff'\)/g, ''))
    for (const match of css.matchAll(/url\(['"]?(\.\/files\/[^'"\s)]+)['"]?\)/g)) {
      await fs.copyFile(path.join(source, match[1]), path.join(destination, match[1]))
    }
    sheets.push(css)
  }
  await fs.writeFile(path.join(destination, output), sheets.join('\n'))
  for (const name of licenses) {
    await fs.copyFile(path.join(source, name), path.join(destination, name))
  }
}

function latinOnly(css) {
  const latin = [[0, 0x024f], [0x0300, 0x036f], [0x1e00, 0x1eff], [0x2000, 0x206f], [0x20a0, 0x20cf], [0x2100, 0x214f]]
  return [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].flatMap(([face]) => {
    const ranges = /unicode-range:\s*([^;}]+)/.exec(face)[1].split(',').flatMap(range => {
      const [start, end = start] = range.trim().slice(2).split('-').map(value => parseInt(value, 16))
      return latin.flatMap(([min, max]) => {
        const lo = Math.max(start, min), hi = Math.min(end, max)
        return lo > hi ? [] : [`U+${lo.toString(16)}${hi === lo ? '' : '-' + hi.toString(16)}`]
      })
    })
    return ranges.length ? [face.replace("'LXGW WenKai Mono'", "'LXGW WenKai Mono Latin'")
      .replace(/unicode-range:\s*[^;}]+/, `unicode-range: ${ranges.join(', ')}\n`)] : []
  }).join('\n')
}

await prepare('@fontsource/maple-mono', 'maple-mono',
  [400, 500, 600, 700].flatMap(weight => [`latin-${weight}.css`, `latin-${weight}-italic.css`]),
  ['LICENSE'])
await prepare('lxgw-wenkai-webfont', 'lxgw-wenkai',
  ['lxgwwenkai-regular.css', 'lxgwwenkai-bold.css'], ['LICENSE', 'OFL.txt'])
const monoStyles = ['lxgwwenkaimono-regular.css', 'lxgwwenkaimono-bold.css']
await prepare('lxgw-wenkai-webfont', 'lxgw-wenkai', monoStyles, [], 'mono.css')
// A Latin-only alias prevents the English override from replacing Chinese glyphs.
await prepare('lxgw-wenkai-webfont', 'lxgw-wenkai', monoStyles, [], 'mono-latin.css', latinOnly)
