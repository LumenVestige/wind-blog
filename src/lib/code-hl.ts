import hljs from 'highlight.js'

/** highlight.js language map used by the blog markdown renderer. */
export function mapHljsLang(lang: string): string {
  const l = (lang || 'text').toLowerCase()
  const map: Record<string, string> = {
    text: 'plaintext',
    plain: 'plaintext',
    plaintext: 'plaintext',
    cpp: 'cpp',
    c: 'c',
    csharp: 'csharp',
    cs: 'csharp',
    py: 'python',
    python: 'python',
    js: 'javascript',
    javascript: 'javascript',
    ts: 'typescript',
    typescript: 'typescript',
    go: 'go',
    golang: 'go',
    sh: 'bash',
    shell: 'bash',
    bash: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    md: 'markdown',
    markdown: 'markdown',
    rs: 'rust',
    rust: 'rust',
    kt: 'kotlin',
    kotlin: 'kotlin',
    proto: 'protobuf',
    protobuf: 'protobuf',
    objectivec: 'objectivec',
    'objective-c': 'objectivec',
    asm: 'x86asm',
    assembly: 'x86asm',
  }
  return map[l] || l
}

export function highlightWith(
  engine: typeof hljs,
  code: string,
  language?: string,
): string {
  const lang = mapHljsLang(language || 'text')
  try {
    const useLang = lang === 'plaintext' || !engine.getLanguage(lang) ? 'plaintext' : lang
    return engine.highlight(code, { language: useLang }).value
  } catch {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

export function loadHljs(): Promise<typeof hljs> {
  return Promise.resolve(hljs)
}

export function getHljs(): typeof hljs {
  return hljs
}
