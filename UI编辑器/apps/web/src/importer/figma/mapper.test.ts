import { describe, expect, it } from 'vitest'
import { mapFigmaToDocument, parseFigmaFileKey, type FigmaFileResponse } from './mapper'

describe('parseFigmaFileKey', () => {
  it('parses file and design urls', () => {
    expect(parseFigmaFileKey('https://www.figma.com/file/AbC123/My-Design')).toBe('AbC123')
    expect(parseFigmaFileKey('https://www.figma.com/design/XyZ789/Title?node-id=1-2')).toBe('XyZ789')
  })

  it('throws on invalid url', () => {
    expect(() => parseFigmaFileKey('https://example.com/nope')).toThrow(/无法从 URL 解析/)
  })
})

describe('mapFigmaToDocument', () => {
  const file: FigmaFileResponse = {
    name: 'Demo',
    document: {
      id: '0:0',
      name: 'Document',
      type: 'DOCUMENT',
      children: [
        {
          id: '0:1',
          name: 'Page 1',
          type: 'CANVAS',
          children: [
            {
              id: '1:1',
              name: 'Home',
              type: 'FRAME',
              absoluteBoundingBox: { x: 100, y: 200, width: 375, height: 812 },
              fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
              children: [
                {
                  id: '1:2',
                  name: 'Title',
                  type: 'TEXT',
                  absoluteBoundingBox: { x: 124, y: 248, width: 200, height: 32 },
                  characters: 'Hello',
                  fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
                  style: {
                    fontSize: 24,
                    fontWeight: 700,
                    fontFamily: 'Inter',
                    textAlignHorizontal: 'CENTER',
                  },
                },
                {
                  id: '1:3',
                  name: 'Box',
                  type: 'RECTANGLE',
                  absoluteBoundingBox: { x: 124, y: 300, width: 120, height: 80 },
                  cornerRadius: 8,
                  fills: [{ type: 'SOLID', color: { r: 0.145, g: 0.388, b: 0.922, a: 1 } }],
                },
                {
                  id: '1:4',
                  name: 'Hidden',
                  type: 'RECTANGLE',
                  visible: false,
                  absoluteBoundingBox: { x: 124, y: 400, width: 10, height: 10 },
                },
              ],
            },
          ],
        },
      ],
    },
  }

  it('maps artboard, relative positions and styles', () => {
    const doc = mapFigmaToDocument(file)
    expect(doc.meta.name).toBe('Demo')
    expect(doc.root.x).toBe(0)
    expect(doc.root.y).toBe(0)
    expect(doc.root.width).toBe(375)
    expect(doc.root.height).toBe(812)
    expect(doc.root.style.backgroundColor).toBe('#ffffff')

    const kids = doc.root.children ?? []
    expect(kids).toHaveLength(2)

    const title = kids.find((n) => n.name === 'Title')
    expect(title?.type).toBe('text')
    expect(title?.x).toBe(24)
    expect(title?.y).toBe(48)
    expect(title?.props?.text).toBe('Hello')
    expect(title?.style.fontSize).toBe(24)
    expect(title?.style.textAlign).toBe('center')
    expect(title?.style.color).toBe('#000000')

    const box = kids.find((n) => n.name === 'Box')
    expect(box?.type).toBe('rect')
    expect(box?.style.borderRadius).toBe(8)
    expect(box?.style.backgroundColor).toMatch(/^#/)
  })

  it('converts image-filled nodes via imageUrls', () => {
    const doc = mapFigmaToDocument(file, { '1:3': 'https://cdn.example/box.png' })
    const box = doc.root.children?.find((n) => n.name === 'Box')
    expect(box?.type).toBe('image')
    expect(box?.props?.src).toBe('https://cdn.example/box.png')
  })

  it('prefers the largest artboard among frames', () => {
    const multi: FigmaFileResponse = {
      name: 'Multi',
      document: {
        id: 'd',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: 'p',
            name: 'Page',
            type: 'CANVAS',
            children: [
              {
                id: 'small',
                name: 'Small',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
              },
              {
                id: 'large',
                name: 'Large',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 800 },
              },
            ],
          },
        ],
      },
    }
    const doc = mapFigmaToDocument(multi)
    expect(doc.root.name).toBe('Large')
    expect(doc.root.width).toBe(400)
  })
})
