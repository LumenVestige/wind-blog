/** Fired after an in-site article route commits, never on the initial visit. */
export const ARTICLE_ENTRANCE_EVENT = 'wind:article-enter'

export const BLOG_MOTION = {
  exit: 220,
  pageEnter: 400,
  titleEnter: 360,
  bodyEnter: 400,
  bodyStagger: 45,
  bodyMaxDelay: 180,
} as const
