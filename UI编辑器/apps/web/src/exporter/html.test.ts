import { describe, expect, it } from 'vitest'
import { createNode } from '../schema/defaults'
import { exportHtmlCss } from './html'

describe('exportHtmlCss', () => {
  it('exports adaptive rem by default', () => {
    const root = createNode('frame', {
      id: 'root',
      width: 375,
      height: 200,
      children: [
        createNode('text', {
          id: 't1',
          x: 10,
          y: 20,
          props: { text: '<Hello>&' },
        }),
        createNode('button', {
          id: 'b1',
          x: 10,
          y: 60,
          props: { text: '点击' },
        }),
      ],
    })

    const { html, css } = exportHtmlCss(root, '测试页')

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>测试页</title>')
    expect(html).toContain('&lt;Hello&gt;&amp;')
    expect(html).toContain('点击')
    expect(html).toContain('class="n-text-0-0"')
    expect(css).toContain('.n-frame-0 {')
    expect(css).toContain('html { font-size: calc(100vw / 3.75); }')
    expect(css).toContain('width: 100%;')
    expect(css).toContain('left: 0.1rem;')
    expect(css).toContain('top: 0.2rem;')
    expect(css).not.toContain('left: 10px;')
  })

  it('exports rem with adaptive root font-size', () => {
    const root = createNode('frame', {
      width: 1920,
      height: 1080,
      children: [createNode('rect', { x: 100, y: 50, width: 200, height: 80 })],
    })
    const { css } = exportHtmlCss(root, 'rem页', { unit: 'rem', designWidth: 1920 })
    expect(css).toContain('html { font-size: calc(100vw / 19.2); }')
    expect(css).toContain('width: 100%;')
    expect(css).toContain('height: 10.8rem;')
    expect(css).toContain('left: 1rem;')
    expect(css).not.toContain('left: 100px;')
  })

  it('can still export fixed px when requested', () => {
    const root = createNode('frame', {
      width: 375,
      height: 200,
      children: [createNode('rect', { x: 10, y: 20, width: 100, height: 40 })],
    })
    const { css } = exportHtmlCss(root, 'px页', { unit: 'px' })
    expect(css).toContain('width: 375px;')
    expect(css).toContain('left: 10px;')
    expect(css).not.toContain('font-size: calc(100vw')
  })

  it('escapes image attributes', () => {
    const root = createNode('frame', {
      children: [
        createNode('image', {
          props: { src: 'https://example.com/a.png?x="1"', alt: 'pic"<' },
        }),
      ],
    })
    const { html } = exportHtmlCss(root)
    expect(html).toContain('&quot;')
    expect(html).toContain('alt="pic&quot;&lt;"')
  })

  it('writes data-url images as static assets', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const root = createNode('frame', {
      children: [
        createNode('image', { props: { src: png, alt: 'a' } }),
        createNode('image', { props: { src: png, alt: 'b' } }),
      ],
    })
    const { html, assets } = exportHtmlCss(root)
    expect(html).toContain('src="./assets/img-0.png"')
    expect(html).not.toContain('data:image')
    expect(assets).toHaveLength(1)
    expect(assets[0].path).toBe('assets/img-0.png')
    expect(assets[0].mime).toBe('image/png')
  })
})
