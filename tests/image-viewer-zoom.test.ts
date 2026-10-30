import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindImageViewerZoom } from '@/lib/image-viewer-zoom'

class Surface extends EventTarget {
  clientHeight = 720
  getBoundingClientRect() { return { left: 20, top: 30 } }
}

function input(type: string, values: Record<string, number | boolean> = {}) {
  return Object.assign(new Event(type, { cancelable: true }), values)
}

function setup() {
  const root = new EventTarget()
  const surface = new Surface()
  const zoom = vi.fn()
  const cleanup = bindImageViewerZoom(root as HTMLElement, { zoom } as never)
  const view = (target = surface) => root.dispatchEvent(new CustomEvent('viewed', {
    detail: { image: { closest: () => target } },
  }))
  view()
  return { root, surface, zoom, cleanup, view }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16))
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('image viewer zoom input', () => {
  it('zooms around the pointer and prevents scrolling the page behind the viewer', () => {
    const { surface, zoom, cleanup } = setup()
    const event = input('wheel', { deltaY: -100, deltaMode: 0, clientX: 120, clientY: 180 })
    surface.dispatchEvent(event)
    vi.advanceTimersByTime(16)
    expect(event.defaultPrevented).toBe(true)
    expect(zoom).toHaveBeenCalledWith(expect.closeTo(Math.exp(0.2) - 1), true, { x: 100, y: 150 })
    cleanup()
  })

  it('combines precision-trackpad events in a frame and supports zooming out', () => {
    const { surface, zoom, cleanup } = setup()
    for (let i = 0; i < 4; i++) surface.dispatchEvent(input('wheel', { deltaY: 1, deltaMode: 0, ctrlKey: true, clientX: 80, clientY: 90 }))
    vi.advanceTimersByTime(16)
    expect(zoom).toHaveBeenCalledTimes(1)
    expect(zoom.mock.calls[0][0]).toBeCloseTo(1 - Math.exp(0.04))
    cleanup()
  })

  it('normalizes line-based mouse wheels and bounds large wheel jumps', () => {
    const { surface, zoom, cleanup } = setup()
    surface.dispatchEvent(input('wheel', { deltaY: -100, deltaMode: 1, clientX: 80, clientY: 90 }))
    vi.advanceTimersByTime(16)
    expect(zoom.mock.calls[0][0]).toBeCloseTo(Math.exp(0.24) - 1)
    cleanup()
  })

  it('supports Safari pinch while suppressing duplicate wheel input', () => {
    const { surface, zoom, cleanup } = setup()
    surface.dispatchEvent(input('gesturestart', { scale: 1 }))
    surface.dispatchEvent(input('gesturechange', { scale: 1.5, clientX: 120, clientY: 130 }))
    surface.dispatchEvent(input('wheel', { deltaY: -100, ctrlKey: true }))
    vi.advanceTimersByTime(16)
    expect(zoom).toHaveBeenCalledWith(0.5, true, { x: 100, y: 100 })
    surface.dispatchEvent(input('gestureend'))
    surface.dispatchEvent(input('wheel', { deltaY: 10, clientX: 120, clientY: 130 }))
    vi.advanceTimersByTime(16)
    expect(zoom).toHaveBeenCalledTimes(2)
    cleanup()
  })

  it('removes old image listeners and cancels queued work when closing', () => {
    const { root, surface, zoom, cleanup, view } = setup()
    const next = new Surface()
    view(next)
    surface.dispatchEvent(input('wheel', { deltaY: -10 }))
    vi.advanceTimersByTime(16)
    expect(zoom).not.toHaveBeenCalled()
    next.dispatchEvent(input('wheel', { deltaY: -10 }))
    root.dispatchEvent(new Event('hide'))
    vi.advanceTimersByTime(16)
    expect(zoom).not.toHaveBeenCalled()
    const event = input('wheel', { deltaY: -10 })
    next.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    cleanup()
  })
})
