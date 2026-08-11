import { describe, expect, it } from 'vitest'
import { applyParsedCssToNode, parseLanhuCss } from './parseCss'
import { createNode } from '../../schema/defaults'

describe('parseLanhuCss', () => {
  it('parses common lanhu css declarations', () => {
    const parsed = parseLanhuCss(`
      width: 120px;
      height: 40px;
      background: #1677FF;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #FFFFFF;
      text-align: center;
      opacity: 0.9;
      box-shadow: 0px 2px 8px 0px rgba(0,0,0,0.12);
      border: 1px solid #E5E5E5;
    `)

    expect(parsed.layout.width).toBe(120)
    expect(parsed.layout.height).toBe(40)
    expect(parsed.style.backgroundColor).toBe('#1677FF')
    expect(parsed.style.borderRadius).toBe(8)
    expect(parsed.style.fontSize).toBe(14)
    expect(parsed.style.fontWeight).toBe(500)
    expect(parsed.style.color).toBe('#FFFFFF')
    expect(parsed.style.textAlign).toBe('center')
    expect(parsed.style.opacity).toBe(0.9)
    expect(parsed.style.boxShadow).toContain('rgba')
    expect(parsed.style.borderWidth).toBe(1)
    expect(parsed.style.borderColor).toBe('#E5E5E5')
    expect(parsed.applied.length).toBeGreaterThan(5)
  })

  it('supports chinese labels and selector blocks', () => {
    const parsed = parseLanhuCss(`
      .btn {
        宽度：100px;
        高度：36px;
        圆角：4px;
        背景色：rgba(22, 119, 255, 1);
      }
    `)
    expect(parsed.layout.width).toBe(100)
    expect(parsed.layout.height).toBe(36)
    expect(parsed.style.borderRadius).toBe(4)
    expect(parsed.style.backgroundColor).toContain('rgba')
  })

  it('applies parsed result onto a node', () => {
    const node = createNode('button')
    const parsed = parseLanhuCss('width: 200px; height: 48px; background: #000; color: #fff;')
    const patch = applyParsedCssToNode(node, parsed)
    expect(patch.width).toBe(200)
    expect(patch.height).toBe(48)
    expect(patch.style?.backgroundColor).toBe('#000')
    expect(patch.style?.color).toBe('#fff')
  })
})
