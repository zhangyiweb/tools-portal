import type { UINode } from './types'
import { findNode, findParent } from './defaults'

export type LayerDropPosition = 'before' | 'after' | 'inside'

/**
 * 根据拖放到目标行的位置，计算新父节点与插入下标。
 * 返回的 index 基于「拖拽节点已移除」后的 children。
 */
export function resolveLayerDrop(
  root: UINode,
  dragId: string,
  targetId: string,
  position: LayerDropPosition,
): { parentId: string; index: number } | null {
  if (dragId === targetId) return null

  if (position === 'inside') {
    const target = findNode(root, targetId)
    if (!target) return null
    let index = target.children?.length ?? 0
    // 若当前已在该父下，移除后末尾下标 -1
    const oldParent = findParent(root, dragId)
    if (oldParent?.id === targetId) {
      index = Math.max(0, (target.children?.length ?? 1) - 1)
    }
    return { parentId: targetId, index }
  }

  // 根节点不能作为兄弟插入：一律当作放入根末尾
  if (targetId === root.id) {
    let index = root.children?.length ?? 0
    const oldParent = findParent(root, dragId)
    if (oldParent?.id === root.id) {
      index = Math.max(0, (root.children?.length ?? 1) - 1)
    }
    return { parentId: root.id, index }
  }

  const parent = findParent(root, targetId)
  if (!parent?.children) return null
  const targetIndex = parent.children.findIndex((c) => c.id === targetId)
  if (targetIndex < 0) return null

  let insertAt = position === 'before' ? targetIndex : targetIndex + 1
  const from = parent.children.findIndex((c) => c.id === dragId)
  if (from >= 0 && from < insertAt) insertAt -= 1

  return { parentId: parent.id, index: insertAt }
}

export function dropPositionFromOffset(
  offsetY: number,
  height: number,
  allowInside: boolean,
): LayerDropPosition {
  if (!allowInside) {
    return offsetY < height / 2 ? 'before' : 'after'
  }
  const ratio = offsetY / Math.max(height, 1)
  if (ratio < 0.28) return 'before'
  if (ratio > 0.72) return 'after'
  return 'inside'
}
