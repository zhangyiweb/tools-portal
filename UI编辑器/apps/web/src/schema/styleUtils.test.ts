import { describe, expect, it } from 'vitest'
import { createNode } from './defaults'
import { formatLength } from './units'
import { nodeBoxStyle, stylePropsToCssText, styleToCss } from './styleUtils'

describe('styleToCss', () => {
  it('maps style props to CSSProperties', () => {
    const css = styleToCss({
      backgroundColor: '#fff',
      fontSize: 14,
      borderWidth: 2,
      borderColor: '#ccc',
      opacity: 0.5,
    })
    expect(css.backgroundColor).toBe('#fff')
    expect(css.fontSize).toBe(14)
    expect(css.borderWidth).toBe(2)
    expect(css.borderStyle).toBe('solid')
    expect(css.borderColor).toBe('#ccc')
    expect(css.opacity).toBe(0.5)
  })

  it('applies background image with defaults', () => {
    const css = styleToCss({
      backgroundImage: '/api/files/p/a.png',
      backgroundColor: '#111',
    })
    expect(css.backgroundImage).toBe('url("/api/files/p/a.png")')
    expect(css.backgroundSize).toBe('cover')
    expect(css.backgroundPosition).toBe('center')
    expect(css.backgroundRepeat).toBe('no-repeat')
    expect(css.backgroundColor).toBe('#111')
  })
})

describe('nodeBoxStyle', () => {
  it('uses relative layout for root and absolute for children', () => {
    const node = createNode('rect', { x: 12, y: 34, width: 100, height: 50 })
    const root = nodeBoxStyle(node, true)
    expect(root.position).toBe('relative')
    expect(root.left).toBeUndefined()
    expect(root.width).toBe(100)

    const child = nodeBoxStyle(node, false)
    expect(child.position).toBe('absolute')
    expect(child.left).toBe(12)
    expect(child.top).toBe(34)
  })

  it('hides invisible nodes', () => {
    const node = createNode('rect', { visible: false })
    expect(nodeBoxStyle(node).display).toBe('none')
  })
})

describe('stylePropsToCssText', () => {
  it('serializes px units and merges extras', () => {
    const text = stylePropsToCssText(
      { fontSize: 16, borderRadius: 8, color: '#111' },
      { position: 'absolute', left: '10px' },
    )
    expect(text).toContain('font-size: 16px;')
    expect(text).toContain('border-radius: 8px;')
    expect(text).toContain('color: #111;')
    expect(text).toContain('position: absolute;')
    expect(text).toContain('left: 10px;')
  })

  it('omits empty values', () => {
    const text = stylePropsToCssText({ backgroundColor: '', color: '#000' })
    expect(text).not.toContain('background-color')
    expect(text).toContain('color: #000;')
  })

  it('serializes rem units when requested', () => {
    const text = stylePropsToCssText(
      { fontSize: 16, borderRadius: 8, color: '#111' },
      { left: formatLength(10, 'rem') },
      { unit: 'rem' },
    )
    expect(text).toContain('font-size: 0.16rem;')
    expect(text).toContain('border-radius: 0.08rem;')
    expect(text).toContain('left: 0.1rem;')
  })
})
