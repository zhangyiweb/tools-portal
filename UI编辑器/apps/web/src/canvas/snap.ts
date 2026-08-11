import type { UINode } from '../schema/types'
import { findParent } from '../schema/defaults'

export type AlignGuide = {
  orientation: 'v' | 'h'
  /** 相对父容器的坐标 */
  position: number
}

export type SnapRect = { x: number; y: number; width: number; height: number }

const DEFAULT_THRESHOLD = 6

function uniqSorted(nums: number[]): number[] {
  return [...new Set(nums.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b)
}

/** 收集吸附参考线（父容器边界 + 兄弟节点），坐标相对 parent */
export function collectSnapLines(
  root: UINode,
  movingId: string,
): { xs: number[]; ys: number[]; parent: UINode } {
  const parent = findParent(root, movingId) ?? root
  const xs = [0, parent.width / 2, parent.width]
  const ys = [0, parent.height / 2, parent.height]

  for (const c of parent.children ?? []) {
    if (c.id === movingId || c.visible === false) continue
    xs.push(c.x, c.x + c.width / 2, c.x + c.width)
    ys.push(c.y, c.y + c.height / 2, c.y + c.height)
  }

  return { xs: uniqSorted(xs), ys: uniqSorted(ys), parent }
}

/** 移动吸附 */
export function snapPosition(
  rect: SnapRect,
  xs: number[],
  ys: number[],
  threshold = DEFAULT_THRESHOLD,
): { x: number; y: number; guides: AlignGuide[] } {
  const xEdges = [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
  const yEdges = [rect.y, rect.y + rect.height / 2, rect.y + rect.height]

  let bestXDelta = 0
  let bestXDist = threshold + 1
  let xGuide: number | null = null
  for (const edge of xEdges) {
    for (const t of xs) {
      const d = Math.abs(edge - t)
      if (d <= threshold && d < bestXDist) {
        bestXDist = d
        bestXDelta = t - edge
        xGuide = t
      }
    }
  }

  let bestYDelta = 0
  let bestYDist = threshold + 1
  let yGuide: number | null = null
  for (const edge of yEdges) {
    for (const t of ys) {
      const d = Math.abs(edge - t)
      if (d <= threshold && d < bestYDist) {
        bestYDist = d
        bestYDelta = t - edge
        yGuide = t
      }
    }
  }

  const guides: AlignGuide[] = []
  if (xGuide != null) guides.push({ orientation: 'v', position: xGuide })
  if (yGuide != null) guides.push({ orientation: 'h', position: yGuide })

  return {
    x: Math.round(rect.x + bestXDelta),
    y: Math.round(rect.y + bestYDelta),
    guides,
  }
}

/** 缩放吸附 */
export function snapResize(
  rect: SnapRect,
  handle: string,
  xs: number[],
  ys: number[],
  threshold = DEFAULT_THRESHOLD,
): { rect: SnapRect; guides: AlignGuide[] } {
  let { x, y, width, height } = rect
  const guides: AlignGuide[] = []
  const min = 8

  if (handle.includes('e')) {
    const right = x + width
    let best = right
    let dist = threshold + 1
    let g: number | null = null
    for (const t of xs) {
      const d = Math.abs(right - t)
      if (d <= threshold && d < dist) {
        dist = d
        best = t
        g = t
      }
    }
    if (g != null) {
      width = Math.max(min, best - x)
      guides.push({ orientation: 'v', position: g })
    }
  }
  if (handle.includes('w')) {
    const left = x
    let best = left
    let dist = threshold + 1
    let g: number | null = null
    for (const t of xs) {
      const d = Math.abs(left - t)
      if (d <= threshold && d < dist) {
        dist = d
        best = t
        g = t
      }
    }
    if (g != null) {
      const right = x + width
      x = best
      width = Math.max(min, right - x)
      guides.push({ orientation: 'v', position: g })
    }
  }
  if (handle.includes('s')) {
    const bottom = y + height
    let best = bottom
    let dist = threshold + 1
    let g: number | null = null
    for (const t of ys) {
      const d = Math.abs(bottom - t)
      if (d <= threshold && d < dist) {
        dist = d
        best = t
        g = t
      }
    }
    if (g != null) {
      height = Math.max(min, best - y)
      guides.push({ orientation: 'h', position: g })
    }
  }
  if (handle.includes('n')) {
    const top = y
    let best = top
    let dist = threshold + 1
    let g: number | null = null
    for (const t of ys) {
      const d = Math.abs(top - t)
      if (d <= threshold && d < dist) {
        dist = d
        best = t
        g = t
      }
    }
    if (g != null) {
      const bottom = y + height
      y = best
      height = Math.max(min, bottom - y)
      guides.push({ orientation: 'h', position: g })
    }
  }

  return {
    rect: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    },
    guides,
  }
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** 相对父容器对齐 */
export function alignInParent(node: UINode, parent: UINode, mode: AlignMode): Partial<UINode> {
  switch (mode) {
    case 'left':
      return { x: 0 }
    case 'center':
      return { x: Math.round((parent.width - node.width) / 2) }
    case 'right':
      return { x: Math.round(parent.width - node.width) }
    case 'top':
      return { y: 0 }
    case 'middle':
      return { y: Math.round((parent.height - node.height) / 2) }
    case 'bottom':
      return { y: Math.round(parent.height - node.height) }
  }
}
