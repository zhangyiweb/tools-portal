import { describe, expect, it } from 'vitest'
import {
  formatLength,
  pxToRem,
  remRootFontSizeCss,
  resolveExportUnit,
  scaleNodeTree,
  convertPxInCssValue,
} from './units'
import { createNode } from './defaults'

describe('units', () => {
  it('formats px and rem', () => {
    expect(formatLength(120, 'px')).toBe('120px')
    expect(formatLength(120, 'rem')).toBe('1.2rem')
    expect(pxToRem(100)).toBe(1)
  })

  it('builds adaptive root font-size for rem', () => {
    expect(remRootFontSizeCss(1920)).toContain('calc(100vw / 19.2)')
  })

  it('defaults export unit to rem', () => {
    expect(resolveExportUnit()).toBe('rem')
    expect(resolveExportUnit('rem')).toBe('rem')
    expect(resolveExportUnit('px')).toBe('px')
  })

  it('converts px inside box-shadow', () => {
    expect(convertPxInCssValue('0px 2px 8px 0px rgba(0,0,0,.12)', 'rem')).toBe(
      '0rem 0.02rem 0.08rem 0rem rgba(0,0,0,.12)',
    )
  })

  it('scales node tree by width ratio', () => {
    const child = createNode('rect', { x: 100, y: 50, width: 200, height: 100 })
    const root = createNode('frame', {
      width: 1920,
      height: 1080,
      children: [child],
    })
    const scaled = scaleNodeTree(root, 0.5, true)
    expect(scaled.children?.[0].x).toBe(50)
    expect(scaled.children?.[0].width).toBe(100)
    expect(scaled.children?.[0].height).toBe(50)
  })
})
