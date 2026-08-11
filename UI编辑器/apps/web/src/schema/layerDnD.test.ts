import { describe, expect, it } from 'vitest'
import { createNode } from './defaults'
import { dropPositionFromOffset, resolveLayerDrop } from './layerDnD'

const root = createNode('frame', {
  id: 'root',
  children: [
    createNode('text', { id: 'a' }),
    createNode('text', { id: 'b' }),
    createNode('frame', {
      id: 'c',
      children: [createNode('button', { id: 'c1' })],
    }),
  ],
})

describe('resolveLayerDrop', () => {
  it('inserts before/after as sibling with same-parent index fix', () => {
    expect(resolveLayerDrop(root, 'a', 'b', 'before')).toEqual({
      parentId: 'root',
      index: 0,
    })
    expect(resolveLayerDrop(root, 'a', 'b', 'after')).toEqual({
      parentId: 'root',
      index: 1,
    })
    expect(resolveLayerDrop(root, 'b', 'a', 'before')).toEqual({
      parentId: 'root',
      index: 0,
    })
  })

  it('nests inside target and adjusts when already a child', () => {
    expect(resolveLayerDrop(root, 'a', 'c', 'inside')).toEqual({
      parentId: 'c',
      index: 1,
    })
    expect(resolveLayerDrop(root, 'c1', 'c', 'inside')).toEqual({
      parentId: 'c',
      index: 0,
    })
  })

  it('forces root drops to append as child', () => {
    expect(resolveLayerDrop(root, 'a', 'root', 'before')).toEqual({
      parentId: 'root',
      index: 2,
    })
    expect(resolveLayerDrop(root, 'a', 'root', 'inside')).toEqual({
      parentId: 'root',
      index: 2,
    })
  })

  it('rejects dropping onto self', () => {
    expect(resolveLayerDrop(root, 'a', 'a', 'inside')).toBeNull()
  })
})

describe('dropPositionFromOffset', () => {
  it('splits into before / inside / after bands', () => {
    expect(dropPositionFromOffset(5, 40, true)).toBe('before')
    expect(dropPositionFromOffset(20, 40, true)).toBe('inside')
    expect(dropPositionFromOffset(35, 40, true)).toBe('after')
  })

  it('uses half split when inside is disabled', () => {
    expect(dropPositionFromOffset(10, 40, false)).toBe('before')
    expect(dropPositionFromOffset(30, 40, false)).toBe('after')
  })
})
