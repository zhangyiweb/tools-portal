import { describe, expect, it } from 'vitest'
import { createNode } from '../schema/defaults'
import { alignInParent, collectSnapLines, snapPosition, snapResize } from './snap'

describe('snap', () => {
  it('snaps to sibling edge', () => {
    const sibling = createNode('rect', { id: 'a', x: 100, y: 50, width: 80, height: 40 })
    const moving = createNode('rect', { id: 'b', x: 0, y: 0, width: 60, height: 30 })
    const root = createNode('frame', {
      width: 400,
      height: 300,
      children: [sibling, moving],
    })
    const { xs, ys } = collectSnapLines(root, 'b')
    const snapped = snapPosition({ x: 95, y: 48, width: 60, height: 30 }, xs, ys, 6)
    expect(snapped.x).toBe(100)
    expect(snapped.y).toBe(50)
    expect(snapped.guides.some((g) => g.orientation === 'v' && g.position === 100)).toBe(true)
  })

  it('snaps resize right edge', () => {
    const result = snapResize(
      { x: 10, y: 10, width: 88, height: 40 },
      'e',
      [100],
      [],
      6,
    )
    expect(result.rect.width).toBe(90)
    expect(result.guides[0]?.position).toBe(100)
  })

  it('aligns to parent center', () => {
    const parent = createNode('frame', { width: 200, height: 100 })
    const node = createNode('rect', { width: 40, height: 20 })
    expect(alignInParent(node, parent, 'center')).toEqual({ x: 80 })
    expect(alignInParent(node, parent, 'middle')).toEqual({ y: 40 })
  })
})
