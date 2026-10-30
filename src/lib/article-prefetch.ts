export const ARTICLE_HOVER_MS = 200

export function canPrefetchArticle() {
  const connection = typeof navigator === 'undefined' ? undefined :
    (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType || '')
}

export function createArticleIntent(load: (immediate: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => { if (timer) clearTimeout(timer); timer = undefined }
  return {
    schedule() {
      cancel()
      timer = setTimeout(() => { timer = undefined; load(false) }, ARTICLE_HOVER_MS)
    },
    cancel,
    activate() { cancel(); load(true) },
  }
}
