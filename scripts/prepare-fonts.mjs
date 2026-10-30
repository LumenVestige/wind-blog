import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

async function prepare(packageName, directory, styles, licenses) {
  const source = path.join(root, 'node_modules', packageName)
  const { version } = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'))
  const destination = path.join(root, 'public/fonts', directory, version)
  await fs.mkdir(path.join(destination, 'files'), { recursive: true })
  const sheets = []
  for (const name of styles) {
    // WOFF2 only; preserve unicode-range so browsers fetch matching subsets.
    const css = (await fs.readFile(path.join(source, name), 'utf8'))
      .replace(/,\s*url\([^)]+\.woff\) format\('woff'\)/g, '')
    for (const match of css.matchAll(/url\(['"]?(\.\/files\/[^'"\s)]+)['"]?\)/g)) {
      await fs.copyFile(path.join(source, match[1]), path.join(destination, match[1]))
    }
    sheets.push(css)
  }
  await fs.writeFile(path.join(destination, 'style.css'), sheets.join('\n'))
  for (const name of licenses) {
    await fs.copyFile(path.join(source, name), path.join(destination, name))
  }
}

await prepare('@fontsource/maple-mono', 'maple-mono',
  [400, 500, 600, 700].flatMap(weight => [`latin-${weight}.css`, `latin-${weight}-italic.css`]),
  ['LICENSE'])
// Chinese uses proportional regular/bold; code's Latin glyphs remain Maple Mono.
await prepare('lxgw-wenkai-webfont', 'lxgw-wenkai',
  ['lxgwwenkai-regular.css', 'lxgwwenkai-bold.css'], ['LICENSE', 'OFL.txt'])
