import { describe, expect, it } from 'vitest'
import { DEFAULT_ZOOM, getCenteredPan } from './view'

describe('canvas view', () => {
  it('defaults to 84% zoom', () => {
    expect(DEFAULT_ZOOM).toBe(0.84)
  })

  it('centers artboard in viewport', () => {
    const pan = getCenteredPan(1000, 800, 1920, 1080, 0.84)
    expect(pan.panX).toBe(Math.round((1000 - 1920 * 0.84) / 2))
    expect(pan.panY).toBe(Math.round((800 - 1080 * 0.84) / 2))
  })
})
