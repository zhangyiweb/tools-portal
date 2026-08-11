import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultDocument, findNode } from '../schema/defaults'

describe('useEditorStore', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { useEditorStore } = await import('./editorStore')
    const doc = createDefaultDocument('页面 1')
    useEditorStore.setState({
      projectId: null,
      projectName: '未命名项目',
      assets: [],
      dirty: false,
      pages: [doc],
      activePageId: doc.meta.id,
      doc,
      selectedId: null,
      zoom: 0.84,
      panX: 0,
      panY: 0,
      viewEpoch: 0,
      history: { past: [], future: [] },
      refLayer: null,
      exporting: false,
    })
  })

  it('clamps zoom', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().setZoom(10)
    expect(useEditorStore.getState().zoom).toBe(3)
    useEditorStore.getState().setZoom(0.01)
    expect(useEditorStore.getState().zoom).toBe(0.25)
  })

  it('adds nodes under root and selects them', async () => {
    const { useEditorStore } = await import('./editorStore')
    const before = useEditorStore.getState().doc.root.children?.length ?? 0
    useEditorStore.getState().addNode('rect')
    const state = useEditorStore.getState()
    expect(state.doc.root.children?.length).toBe(before + 1)
    expect(state.selectedId).toBeTruthy()
    expect(findNode(state.doc.root, state.selectedId!)?.type).toBe('rect')
  })

  it('adds node at given position', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().addNode('rect', undefined, { x: 200, y: 120 })
    const id = useEditorStore.getState().selectedId!
    const node = findNode(useEditorStore.getState().doc.root, id)!
    // 以落点为中心放置
    expect(node.x).toBe(200 - Math.round(node.width / 2))
    expect(node.y).toBe(120 - Math.round(node.height / 2))
  })

  it('supports undo/redo for destructive edits', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().addNode('text')
    const selected = useEditorStore.getState().selectedId!
    const countAfterAdd = useEditorStore.getState().doc.root.children?.length ?? 0

    useEditorStore.getState().deleteSelected()
    expect(findNode(useEditorStore.getState().doc.root, selected)).toBeNull()

    useEditorStore.getState().undo()
    expect(findNode(useEditorStore.getState().doc.root, selected)).toBeTruthy()
    expect(useEditorStore.getState().doc.root.children?.length).toBe(countAfterAdd)

    useEditorStore.getState().redo()
    expect(findNode(useEditorStore.getState().doc.root, selected)).toBeNull()
  })

  it('does not delete the root node', async () => {
    const { useEditorStore } = await import('./editorStore')
    const rootId = useEditorStore.getState().doc.root.id
    useEditorStore.getState().setSelected(rootId)
    useEditorStore.getState().deleteSelected()
    expect(useEditorStore.getState().doc.root.id).toBe(rootId)
  })

  it('duplicates selected node with offset', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().addNode('text')
    const original = findNode(
      useEditorStore.getState().doc.root,
      useEditorStore.getState().selectedId!,
    )!
    useEditorStore.getState().duplicateSelected()
    const copyId = useEditorStore.getState().selectedId!
    const copy = findNode(useEditorStore.getState().doc.root, copyId)!
    expect(copyId).not.toBe(original.id)
    expect(copy.x).toBe(original.x + 16)
    expect(copy.y).toBe(original.y + 16)
    expect(copy.name).toContain('副本')
  })

  it('resizes from edges with minimum size', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().addNode('rect')
    const id = useEditorStore.getState().selectedId!
    const node = findNode(useEditorStore.getState().doc.root, id)!
    useEditorStore.getState().updateNode(id, { x: 50, y: 50, width: 100, height: 80 })

    useEditorStore.getState().resizeNode(id, 'se', 20, 10)
    let resized = findNode(useEditorStore.getState().doc.root, id)!
    expect(resized.width).toBe(120)
    expect(resized.height).toBe(90)

    useEditorStore.getState().resizeNode(id, 'nw', 200, 200)
    resized = findNode(useEditorStore.getState().doc.root, id)!
    expect(resized.width).toBe(8)
    expect(resized.height).toBe(8)
    expect(node).toBeTruthy()
  })

  it('keeps edits in memory only', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().addNode('button')
    const id = useEditorStore.getState().selectedId!
    expect(findNode(useEditorStore.getState().doc.root, id)?.type).toBe('button')
    expect(useEditorStore.getState()).not.toHaveProperty('persist')
    expect(useEditorStore.getState()).not.toHaveProperty('hydrate')
  })

  it('scales elements when rem unit and viewport changes', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().setCssUnit('rem')
    useEditorStore.getState().addNode('rect')
    const id = useEditorStore.getState().selectedId!
    useEditorStore.getState().updateNode(id, { x: 100, y: 50, width: 200, height: 100 })
    const beforeW = useEditorStore.getState().doc.root.width
    useEditorStore.getState().setViewport('mobile-375')
    const after = findNode(useEditorStore.getState().doc.root, id)!
    const scale = 375 / beforeW
    expect(after.x).toBeCloseTo(100 * scale, 1)
    expect(after.width).toBeCloseTo(200 * scale, 1)
  })

  it('keeps element size when px unit and viewport changes', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().setCssUnit('px')
    useEditorStore.getState().addNode('rect')
    const id = useEditorStore.getState().selectedId!
    useEditorStore.getState().updateNode(id, { x: 100, width: 200 })
    useEditorStore.getState().setViewport('mobile-375')
    const after = findNode(useEditorStore.getState().doc.root, id)!
    expect(after.x).toBe(100)
    expect(after.width).toBe(200)
  })

  it('supports multiple pages', async () => {
    const { useEditorStore } = await import('./editorStore')
    useEditorStore.getState().addPage()
    expect(useEditorStore.getState().pages.length).toBe(2)
    const secondId = useEditorStore.getState().activePageId
    useEditorStore.getState().addNode('button')
    expect(useEditorStore.getState().doc.root.children?.length).toBe(1)

    const firstId = useEditorStore.getState().pages[0].meta.id
    useEditorStore.getState().switchPage(firstId)
    expect(useEditorStore.getState().activePageId).toBe(firstId)
    expect(useEditorStore.getState().doc.root.children?.length).toBe(0)

    useEditorStore.getState().switchPage(secondId)
    expect(useEditorStore.getState().doc.root.children?.length).toBe(1)

    useEditorStore.getState().deletePage(secondId)
    expect(useEditorStore.getState().pages.length).toBe(1)
  })

  it('reparentNode nests and reorders while keeping selection', async () => {
    const { useEditorStore } = await import('./editorStore')
    const { findParent } = await import('../schema/defaults')
    useEditorStore.getState().addNode('rect', undefined, { x: 100, y: 100 })
    const childId = useEditorStore.getState().selectedId!
    useEditorStore.getState().addNode('frame', undefined, { x: 50, y: 50 })
    const parentId = useEditorStore.getState().selectedId!

    const ok = useEditorStore.getState().reparentNode(childId, parentId, 0)
    expect(ok).toBe(true)
    const root = useEditorStore.getState().doc.root
    expect(findParent(root, childId)?.id).toBe(parentId)
    expect(useEditorStore.getState().selectedId).toBe(childId)
  })
})
