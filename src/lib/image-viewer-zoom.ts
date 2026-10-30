import type Viewer from 'viewerjs'

type GestureEvent = Event & { scale: number; clientX: number; clientY: number }

/** Normalize mouse wheels, precision trackpads and Safari's native pinch events. */
export function bindImageViewerZoom(root: HTMLElement, viewer: Pick<Viewer, 'zoom'>) {
  let surface: HTMLElement | null = null
  let frame = 0
  let factor = 1
  let pivot: { x: number; y: number } | undefined
  let gestureScale = 1
  let gesturing = false

  const zoom = (scale: number, clientX: number, clientY: number) => {
    if (!surface || !Number.isFinite(scale) || scale <= 0) return
    factor = Math.max(0.5, Math.min(2, factor * scale))
    const rect = surface.getBoundingClientRect()
    pivot = { x: clientX - rect.left, y: clientY - rect.top }
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      // Viewer uses reciprocal steps for zooming out, not a signed scale factor.
      viewer.zoom(factor >= 1 ? factor - 1 : 1 - 1 / factor, true, pivot)
      factor = 1
    })
  }

  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    if (gesturing || !event.deltaY) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (surface?.clientHeight || 720) : 1
    const delta = Math.max(-120, Math.min(120, event.deltaY * unit))
    zoom(Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002)), event.clientX, event.clientY)
  }
  const gestureStart = (event: Event) => {
    event.preventDefault()
    gesturing = true
    gestureScale = (event as GestureEvent).scale || 1
  }
  const gestureChange = (event: Event) => {
    event.preventDefault()
    const gesture = event as GestureEvent
    if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) return
    zoom(gesture.scale / gestureScale, gesture.clientX, gesture.clientY)
    gestureScale = gesture.scale
  }
  const gestureEnd = (event: Event) => {
    event.preventDefault()
    gesturing = false
    gestureScale = 1
  }

  const detach = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    factor = 1
    gesturing = false
    surface?.removeEventListener('wheel', wheel, true)
    surface?.removeEventListener('gesturestart', gestureStart)
    surface?.removeEventListener('gesturechange', gestureChange)
    surface?.removeEventListener('gestureend', gestureEnd)
    surface = null
  }
  const attach = (event: Event) => {
    detach()
    const image = (event as CustomEvent<{ image: HTMLImageElement }>).detail?.image
    surface = image?.closest<HTMLElement>('.wind-image-viewer') || null
    if (!surface) return
    surface.addEventListener('wheel', wheel, { passive: false, capture: true })
    surface.addEventListener('gesturestart', gestureStart, { passive: false })
    surface.addEventListener('gesturechange', gestureChange, { passive: false })
    surface.addEventListener('gestureend', gestureEnd, { passive: false })
  }
  root.addEventListener('viewed', attach)
  root.addEventListener('hide', detach)
  return () => {
    detach()
    root.removeEventListener('viewed', attach)
    root.removeEventListener('hide', detach)
  }
}
