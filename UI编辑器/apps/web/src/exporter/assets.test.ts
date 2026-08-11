import { describe, expect, it } from 'vitest'
import { createNode } from '../schema/defaults'
import { materializeImageAssets, parseDataUrl } from './assets'

describe('parseDataUrl', () => {
  it('decodes base64 png', () => {
    const src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const parsed = parseDataUrl(src)
    expect(parsed?.mime).toBe('image/png')
    expect(parsed?.data[0]).toBe(0x89)
  })

  it('returns null for http urls', () => {
    expect(parseDataUrl('https://example.com/a.png')).toBeNull()
  })
})

describe('materializeImageAssets', () => {
  it('rewrites data urls and dedupes identical content', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const root = createNode('frame', {
      children: [
        createNode('image', { id: 'a', props: { src: png } }),
        createNode('image', { id: 'b', props: { src: png } }),
        createNode('image', { id: 'c', props: { src: 'https://cdn.example/x.jpg' } }),
      ],
    })
    const { root: next, assets } = materializeImageAssets(root)
    expect(assets).toHaveLength(1)
    expect(next.children?.[0].props?.src).toBe('./assets/img-0.png')
    expect(next.children?.[1].props?.src).toBe('./assets/img-0.png')
    expect(next.children?.[2].props?.src).toBe('https://cdn.example/x.jpg')
  })
})
