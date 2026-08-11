import { describe, expect, it } from 'vitest'
import { createNode } from '../schema/defaults'
import { exportReact } from './react'

describe('exportReact', () => {
  it('generates a default-exported component', () => {
    const root = createNode('frame', {
      width: 100,
      height: 80,
      children: [
        createNode('text', { props: { text: 'Hi {user}' }, x: 8, y: 8 }),
        createNode('input', { props: { placeholder: '邮箱' }, x: 8, y: 40 }),
      ],
    })

    const { code } = exportReact(root, 'MyPage', { unit: 'px' })
    expect(code).toContain('export default function MyPage()')
    expect(code).toContain('position: "relative"')
    expect(code).toContain('Hi &#123;user&#125;')
    expect(code).toContain('placeholder={"邮箱"}')
    expect(code).toContain('left: 8')
  })

  it('renders button and image nodes', () => {
    const root = createNode('frame', {
      children: [
        createNode('button', { props: { text: 'OK' } }),
        createNode('image', { props: { src: '/a.png', alt: 'a' }, style: { objectFit: 'contain' } }),
      ],
    })
    const { code } = exportReact(root, 'Page', { unit: 'px' })
    expect(code).toContain('<button type="button"')
    expect(code).toContain('OK')
    expect(code).toContain('src={"/a.png"}')
    expect(code).toContain('objectFit: "contain"')
  })

  it('exports rem by default with resize hook and fluid root', () => {
    const root = createNode('frame', {
      width: 1920,
      height: 1080,
      children: [createNode('rect', { x: 100, y: 0, width: 200, height: 40 })],
    })
    const { code } = exportReact(root, 'RemPage', { designWidth: 1920 })
    expect(code).toContain("import { useEffect } from 'react'")
    expect(code).toContain('useEffect')
    expect(code).toContain('"100%"')
    expect(code).toContain('"1rem"')
    expect(code).toContain('"2rem"')
  })

  it('exports rem lengths and resize hook', () => {
    const root = createNode('frame', {
      width: 1920,
      height: 1080,
      children: [createNode('rect', { x: 100, y: 0, width: 200, height: 40 })],
    })
    const { code } = exportReact(root, 'RemPage', { unit: 'rem', designWidth: 1920 })
    expect(code).toContain("import { useEffect } from 'react'")
    expect(code).toContain('useEffect')
    expect(code).toContain('"1rem"')
    expect(code).toContain('"2rem"')
  })

  it('extracts data-url images to assets', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const root = createNode('frame', {
      children: [createNode('image', { props: { src: png, alt: 'dot' } })],
    })
    const { code, assets } = exportReact(root)
    expect(code).toContain('src={"./assets/img-0.png"}')
    expect(code).not.toContain('data:image')
    expect(assets).toHaveLength(1)
    expect(assets[0].path).toBe('assets/img-0.png')
    expect(assets[0].data.byteLength).toBeGreaterThan(0)
  })
})
