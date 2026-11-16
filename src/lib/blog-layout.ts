export const homeLayoutOptions = [
  { value: 'double', label: '双列模式' },
  { value: 'single', label: '单列模式' },
] as const

export type HomeLayout = (typeof homeLayoutOptions)[number]['value']

export function normalizeHomeLayout(value: unknown): HomeLayout {
  return value === 'single' ? 'single' : 'double'
}
