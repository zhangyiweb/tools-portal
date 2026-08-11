import { describe, expect, it } from 'vitest'
import {
  cloneNode,
  createDefaultDocument,
  createNode,
  findNode,
  findParent,
  flattenNodes,
  getAbsolutePos,
  isAncestorOf,
  moveNodeInTree,
  removeNodeFromTree,
  updateNodeInTree,
} from './defaults'

describe('createNode', () => {
  it('creates typed nodes with defaults', () => {
    const text = createNode('text')
    expect(text.type).toBe('text')
    expect(text.name).toBe('文本')
    expect(text.props?.text).toBe('文本内容')
    expect(text.children).toBeUndefined()
    expect(text.style.fontSize).toBe(16)

    const rect = createNode('rect')
    expect(rect.style.borderWidth).toBeUndefined()
    expect(rect.style.borderStyle).toBeUndefined()

    const frame = createNode('frame')
    expect(frame.children).toEqual([])
    expect(frame.width).toBe(1920)
    expect(frame.height).toBe(1080)
  })

  it('applies overrides', () => {
    const node = createNode('button', { x: 10, y: 20, name: 'CTA', props: { text: 'Go' } })
    expect(node.x).toBe(10)
    expect(node.y).toBe(20)
    expect(node.name).toBe('CTA')
    expect(node.props?.text).toBe('Go')
  })
})

describe('createDefaultDocument', () => {
  it('returns an empty 1920×1080 page', () => {
    const doc = createDefaultDocument()
    expect(doc.meta.name).toBe('页面 1')
    expect(doc.root.type).toBe('frame')
    expect(doc.root.children).toEqual([])
    expect(doc.meta.viewportId).toBe('desktop-1920')
    expect(doc.root.width).toBe(1920)
    expect(doc.root.height).toBe(1080)
  })
})

describe('tree helpers', () => {
  const root = createNode('frame', {
    id: 'root',
    children: [
      createNode('text', { id: 't1', name: 'A' }),
      createNode('frame', {
        id: 'f1',
        children: [createNode('button', { id: 'b1', name: 'B' })],
      }),
    ],
  })

  it('findNode locates nested nodes', () => {
    expect(findNode(root, 'b1')?.name).toBe('B')
    expect(findNode(root, 'missing')).toBeNull()
  })

  it('findParent returns direct parent', () => {
    expect(findParent(root, 'b1')?.id).toBe('f1')
    expect(findParent(root, 't1')?.id).toBe('root')
    expect(findParent(root, 'root')).toBeNull()
  })

  it('updateNodeInTree patches immutably', () => {
    const next = updateNodeInTree(root, 't1', (n) => ({ ...n, name: 'A2' }))
    expect(findNode(next, 't1')?.name).toBe('A2')
    expect(findNode(root, 't1')?.name).toBe('A')
    expect(next).not.toBe(root)
  })

  it('removeNodeFromTree drops target and keeps siblings', () => {
    const next = removeNodeFromTree(root, 't1')
    expect(findNode(next, 't1')).toBeNull()
    expect(findNode(next, 'b1')?.id).toBe('b1')
    expect(next.children?.map((c) => c.id)).toEqual(['f1'])
  })

  it('cloneNode regenerates ids recursively', () => {
    const copy = cloneNode(root)
    expect(copy.id).not.toBe(root.id)
    expect(copy.children?.[1].id).not.toBe('f1')
    expect(copy.children?.[1].children?.[0].id).not.toBe('b1')
    expect(copy.children?.[0].name).toBe('A')
  })

  it('flattenNodes walks depth-first', () => {
    const ids = flattenNodes(root).map((n) => n.id)
    expect(ids).toEqual(['root', 't1', 'f1', 'b1'])
  })

  it('getAbsolutePos accumulates parent offsets', () => {
    const tree = createNode('frame', {
      id: 'root',
      x: 0,
      y: 0,
      children: [
        createNode('frame', {
          id: 'f1',
          x: 100,
          y: 50,
          children: [createNode('text', { id: 't1', x: 20, y: 10 })],
        }),
      ],
    })
    expect(getAbsolutePos(tree, 't1')).toEqual({ x: 120, y: 60 })
    expect(getAbsolutePos(tree, 'f1')).toEqual({ x: 100, y: 50 })
  })

  it('isAncestorOf detects ancestry including self', () => {
    expect(isAncestorOf(root, 'f1', 'b1')).toBe(true)
    expect(isAncestorOf(root, 'b1', 'b1')).toBe(true)
    expect(isAncestorOf(root, 't1', 'b1')).toBe(false)
  })

  it('moveNodeInTree reparents and preserves absolute position', () => {
    const tree = createNode('frame', {
      id: 'root',
      x: 0,
      y: 0,
      children: [
        createNode('text', { id: 't1', x: 40, y: 30 }),
        createNode('frame', {
          id: 'f1',
          x: 100,
          y: 50,
          children: [],
        }),
      ],
    })
    const next = moveNodeInTree(tree, 't1', 'f1', 0)
    expect(next).not.toBeNull()
    expect(findParent(next!, 't1')?.id).toBe('f1')
    expect(findNode(next!, 't1')).toMatchObject({ x: -60, y: -20 })
    expect(getAbsolutePos(next!, 't1')).toEqual({ x: 40, y: 30 })
  })

  it('moveNodeInTree rejects cycles and root moves', () => {
    expect(moveNodeInTree(root, 'root', 'f1', 0)).toBeNull()
    expect(moveNodeInTree(root, 'f1', 'b1', 0)).toBeNull()
  })
})
