import { parseHTML } from 'linkedom'

/** HTML document for the markdown sanitizer. Uses the browser when present. */
export function createHtmlDocument(): Document {
  if (typeof document !== 'undefined' && document.implementation?.createHTMLDocument) {
    return document.implementation.createHTMLDocument('')
  }
  const { document: linked } = parseHTML('<!doctype html><html><body></body></html>')
  return linked as unknown as Document
}
