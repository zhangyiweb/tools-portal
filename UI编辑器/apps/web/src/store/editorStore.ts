import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { CssUnit, EditorDocument, NodeType, RefLayer, ResizeHandle, UINode } from '../schema/types'
import type { ProjectAsset } from '../api/projects'
import {
  cloneNode,
  createDefaultDocument,
  createNode,
  findNode,
  findParent,
  moveNodeInTree,
  removeNodeFromTree,
  updateNodeInTree,
} from '../schema/defaults'
import { findViewport } from '../schema/viewports'
import { resolveCssUnit, scaleNodeTree } from '../schema/units'
import { applyParsedCssToNode, parseLanhuCss } from '../importer/lanhu/parseCss'
import { DEFAULT_ZOOM } from '../canvas/view'
import { alignInParent, type AlignMode } from '../canvas/snap'

interface HistoryState {
  past: EditorDocument[]
  future: EditorDocument[]
}

type SetFn = (
  partial:
    | Partial<EditorState>
    | ((state: EditorState) => Partial<EditorState>),
) => void
type GetFn = () => EditorState

interface EditorState {
  projectId: string | null
  projectName: string
  assets: ProjectAsset[]
  dirty: boolean
  pages: EditorDocument[]
  activePageId: string
  doc: EditorDocument
  selectedId: string | null
  zoom: number
  panX: number
  panY: number
  /** 递增后画布重新 84% 居中 */
  viewEpoch: number
  history: HistoryState
  refLayer: RefLayer | null
  exporting: boolean

  setSelected: (id: string | null) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  resetView: () => void
  zoomAt: (nextZoom: number, anchorX: number, anchorY: number) => void
  loadDocument: (doc: EditorDocument) => void
  loadProject: (payload: {
    id: string
    name: string
    pages: EditorDocument[]
    activePageId: string
    assets: ProjectAsset[]
  }) => void
  setProjectName: (name: string) => void
  setAssets: (assets: ProjectAsset[]) => void
  markSaved: () => void
  replaceRoot: (root: UINode) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  addNode: (type: NodeType, parentId?: string, position?: { x: number; y: number }) => void
  addImageFromAsset: (
    asset: { url: string; name: string; width?: number; height?: number },
    position?: { x: number; y: number },
  ) => void
  updateNode: (id: string, patch: Partial<UINode>) => void
  updateNodeStyle: (id: string, style: Partial<UINode['style']>) => void
  updateNodeProps: (id: string, props: Partial<NonNullable<UINode['props']>>) => void
  moveNode: (id: string, x: number, y: number) => void
  resizeNode: (id: string, handle: ResizeHandle, dx: number, dy: number) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  reorderChild: (parentId: string, fromIndex: number, toIndex: number) => void
  /** 将节点移到新父节点下（图层拖拽嵌套 / 排序） */
  reparentNode: (nodeId: string, parentId: string, index: number) => boolean
  setRefLayer: (layer: RefLayer | null) => void
  updateRefLayer: (patch: Partial<RefLayer>) => void
  setViewport: (viewportId: string, custom?: { width: number; height: number }) => void
  renamePage: (name: string) => void
  addPage: () => void
  duplicatePage: (pageId?: string) => void
  deletePage: (pageId: string) => void
  switchPage: (pageId: string) => void
  applyLanhuCss: (cssText: string) => { ok: boolean; message: string }
  setCssUnit: (unit: CssUnit) => void
  alignSelected: (mode: AlignMode) => void
}

function snapshot(doc: EditorDocument): EditorDocument {
  return JSON.parse(JSON.stringify(doc)) as EditorDocument
}

function syncPages(pages: EditorDocument[], activePageId: string, doc: EditorDocument) {
  return pages.map((p) => (p.meta.id === activePageId ? doc : p))
}

function setDoc(set: SetFn, get: GetFn, doc: EditorDocument, extra: Partial<EditorState> = {}) {
  const { pages, activePageId } = get()
  set({
    doc,
    pages: syncPages(pages, activePageId, doc),
    dirty: true,
    ...extra,
  })
}

function applyResize(
  node: UINode,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): Partial<UINode> {
  let { x, y, width, height } = node
  const min = 8

  if (handle.includes('e')) width = Math.max(min, width + dx)
  if (handle.includes('s')) height = Math.max(min, height + dy)
  if (handle.includes('w')) {
    const next = Math.max(min, width - dx)
    x += width - next
    width = next
  }
  if (handle.includes('n')) {
    const next = Math.max(min, height - dy)
    y += height - next
    height = next
  }
  return { x, y, width, height }
}

/** 清除历史版本遗留的 localStorage 数据 */
export function clearLegacyStorage() {
  try {
    localStorage.removeItem('ui-editor-doc-v1')
    localStorage.removeItem('ui-editor-doc-v2')
    localStorage.removeItem('ui-editor-figma-token')
  } catch {
    /* ignore */
  }
}

function initialPage() {
  return createDefaultDocument('页面 1')
}

const firstPage = initialPage()

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: '未命名项目',
  assets: [],
  dirty: false,
  pages: [firstPage],
  activePageId: firstPage.meta.id,
  doc: firstPage,
  selectedId: null,
  zoom: DEFAULT_ZOOM,
  panX: 0,
  panY: 0,
  viewEpoch: 0,
  history: { past: [], future: [] },
  refLayer: null,
  exporting: false,

  setSelected: (id) => set({ selectedId: id }),
  setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.25, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set((s) => ({ zoom: DEFAULT_ZOOM, viewEpoch: s.viewEpoch + 1 })),

  zoomAt: (nextZoom, anchorX, anchorY) => {
    const { zoom, panX, panY } = get()
    const clamped = Math.min(3, Math.max(0.25, nextZoom))
    if (clamped === zoom) return
    const worldX = (anchorX - panX) / zoom
    const worldY = (anchorY - panY) / zoom
    set({
      zoom: clamped,
      panX: anchorX - worldX * clamped,
      panY: anchorY - worldY * clamped,
    })
  },

  loadDocument: (doc) => {
    setDoc(set, get, doc, {
      selectedId: doc.root.id,
      history: { past: [], future: [] },
      dirty: false,
    })
  },

  loadProject: ({ id, name, pages, activePageId, assets }) => {
    const list = pages.length ? pages : [createDefaultDocument('页面 1')]
    const active = list.find((p) => p.meta.id === activePageId) ?? list[0]
    set({
      projectId: id,
      projectName: name,
      assets,
      pages: list,
      activePageId: active.meta.id,
      doc: active,
      selectedId: active.root.id,
      history: { past: [], future: [] },
      refLayer: null,
      dirty: false,
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,
      viewEpoch: get().viewEpoch + 1,
    })
  },

  setProjectName: (name) => set({ projectName: name.trim() || '未命名项目', dirty: true }),
  setAssets: (assets) => set({ assets }),
  markSaved: () => set({ dirty: false }),

  replaceRoot: (root) => {
    get().pushHistory()
    const doc = {
      ...get().doc,
      root,
      meta: { ...get().doc.meta, width: root.width, height: root.height },
    }
    setDoc(set, get, doc, { selectedId: root.id })
  },

  pushHistory: () => {
    const { doc, history } = get()
    set({
      history: {
        past: [...history.past.slice(-49), snapshot(doc)],
        future: [],
      },
    })
  },

  undo: () => {
    const { history, doc } = get()
    if (!history.past.length) return
    const previous = history.past[history.past.length - 1]
    setDoc(set, get, previous, {
      history: {
        past: history.past.slice(0, -1),
        future: [snapshot(doc), ...history.future],
      },
      selectedId: null,
    })
  },

  redo: () => {
    const { history, doc } = get()
    if (!history.future.length) return
    const next = history.future[0]
    setDoc(set, get, next, {
      history: {
        past: [...history.past, snapshot(doc)],
        future: history.future.slice(1),
      },
      selectedId: null,
    })
  },

  addNode: (type, parentId, position) => {
    get().pushHistory()
    const { doc, selectedId } = get()
    const targetId = parentId ?? selectedId ?? doc.root.id
    let parent = findNode(doc.root, targetId)
    if (!parent || (parent.type !== 'frame' && !parent.children)) {
      parent = doc.root
    }
    if (parent.type !== 'frame' && !parent.children) {
      parent = findParent(doc.root, parent.id) ?? doc.root
    }

    const node = createNode(type)
    const x = position
      ? Math.round(
          Math.max(0, Math.min(parent.width - node.width, position.x - node.width / 2)),
        )
      : 24 + Math.round(Math.random() * 40)
    const y = position
      ? Math.round(
          Math.max(0, Math.min(parent.height - node.height, position.y - node.height / 2)),
        )
      : 24 + Math.round(Math.random() * 40)

    const placed = { ...node, x, y }

    const root = updateNodeInTree(doc.root, parent.id, (p) => ({
      ...p,
      children: [...(p.children ?? []), placed],
    }))

    setDoc(set, get, { ...doc, root }, { selectedId: placed.id })
  },

  addImageFromAsset: (asset, position) => {
    get().pushHistory()
    const { doc } = get()
    const parent = doc.root
    const maxW = Math.min(480, parent.width)
    const maxH = Math.min(360, parent.height)
    let width = asset.width && asset.width > 0 ? asset.width : 200
    let height = asset.height && asset.height > 0 ? asset.height : 150
    const scale = Math.min(1, maxW / width, maxH / height)
    width = Math.max(8, Math.round(width * scale))
    height = Math.max(8, Math.round(height * scale))

    const node = createNode('image', {
      name: asset.name.replace(/\.[^.]+$/, '') || '切图',
      width,
      height,
      props: { src: asset.url, alt: asset.name },
    })
    const x = position
      ? Math.round(Math.max(0, Math.min(parent.width - width, position.x - width / 2)))
      : 24 + Math.round(Math.random() * 40)
    const y = position
      ? Math.round(Math.max(0, Math.min(parent.height - height, position.y - height / 2)))
      : 24 + Math.round(Math.random() * 40)
    const placed = { ...node, x, y }
    const root = updateNodeInTree(doc.root, parent.id, (p) => ({
      ...p,
      children: [...(p.children ?? []), placed],
    }))
    setDoc(set, get, { ...doc, root }, { selectedId: placed.id })
  },

  updateNode: (id, patch) => {
    get().pushHistory()
    const root = updateNodeInTree(get().doc.root, id, (n) => ({ ...n, ...patch }))
    setDoc(set, get, { ...get().doc, root })
  },

  updateNodeStyle: (id, style) => {
    get().pushHistory()
    const root = updateNodeInTree(get().doc.root, id, (n) => ({
      ...n,
      style: { ...n.style, ...style },
    }))
    setDoc(set, get, { ...get().doc, root })
  },

  updateNodeProps: (id, props) => {
    get().pushHistory()
    const root = updateNodeInTree(get().doc.root, id, (n) => ({
      ...n,
      props: { ...n.props, ...props },
    }))
    setDoc(set, get, { ...get().doc, root })
  },

  moveNode: (id, x, y) => {
    const root = updateNodeInTree(get().doc.root, id, (n) => ({ ...n, x, y }))
    setDoc(set, get, { ...get().doc, root })
  },

  resizeNode: (id, handle, dx, dy) => {
    const node = findNode(get().doc.root, id)
    if (!node) return
    const patch = applyResize(node, handle, dx, dy)
    const root = updateNodeInTree(get().doc.root, id, (n) => ({ ...n, ...patch }))
    setDoc(set, get, { ...get().doc, root })
  },

  deleteSelected: () => {
    const { selectedId, doc } = get()
    if (!selectedId || selectedId === doc.root.id) return
    get().pushHistory()
    const root = removeNodeFromTree(doc.root, selectedId)
    setDoc(set, get, { ...doc, root }, { selectedId: doc.root.id })
  },

  duplicateSelected: () => {
    const { selectedId, doc } = get()
    if (!selectedId || selectedId === doc.root.id) return
    const node = findNode(doc.root, selectedId)
    const parent = findParent(doc.root, selectedId)
    if (!node || !parent) return
    get().pushHistory()
    const copy = cloneNode(node)
    copy.x += 16
    copy.y += 16
    copy.name = `${node.name} 副本`
    const root = updateNodeInTree(doc.root, parent.id, (p) => ({
      ...p,
      children: [...(p.children ?? []), copy],
    }))
    setDoc(set, get, { ...doc, root }, { selectedId: copy.id })
  },

  reorderChild: (parentId, fromIndex, toIndex) => {
    get().pushHistory()
    const root = updateNodeInTree(get().doc.root, parentId, (p) => {
      const children = [...(p.children ?? [])]
      const [item] = children.splice(fromIndex, 1)
      children.splice(toIndex, 0, item)
      return { ...p, children }
    })
    setDoc(set, get, { ...get().doc, root })
  },

  reparentNode: (nodeId, parentId, index) => {
    const { doc } = get()
    const next = moveNodeInTree(doc.root, nodeId, parentId, index)
    if (!next) return false
    get().pushHistory()
    setDoc(set, get, { ...doc, root: next }, { selectedId: nodeId })
    return true
  },

  setRefLayer: (refLayer) => set({ refLayer }),
  updateRefLayer: (patch) => {
    const current = get().refLayer
    if (!current) return
    set({ refLayer: { ...current, ...patch } })
  },

  setViewport: (viewportId, custom) => {
    get().pushHistory()
    const { doc } = get()
    const preset =
      viewportId === 'custom' && custom
        ? { id: 'custom', width: custom.width, height: custom.height }
        : findViewport(viewportId)

    const unit = resolveCssUnit(doc.meta.cssUnit)
    const oldWidth = doc.root.width || 1
    const scale = unit === 'rem' ? preset.width / oldWidth : 1
    let root =
      scale !== 1 && Number.isFinite(scale) && scale > 0
        ? scaleNodeTree(doc.root, scale, true)
        : doc.root
    root = {
      ...root,
      width: preset.width,
      height: preset.height,
    }

    const next: EditorDocument = {
      ...doc,
      root,
      meta: {
        ...doc.meta,
        width: preset.width,
        height: preset.height,
        viewportId: preset.id,
      },
    }
    setDoc(set, get, next)
  },

  setCssUnit: (unit) => {
    const doc = {
      ...get().doc,
      meta: { ...get().doc.meta, cssUnit: resolveCssUnit(unit) },
    }
    setDoc(set, get, doc)
  },

  renamePage: (name) => {
    const trimmed = name.trim() || '未命名页面'
    const doc = {
      ...get().doc,
      meta: { ...get().doc.meta, name: trimmed },
    }
    setDoc(set, get, doc)
  },

  addPage: () => {
    const { pages } = get()
    const page = createDefaultDocument(`页面 ${pages.length + 1}`)
    set({
      pages: [...pages, page],
      activePageId: page.meta.id,
      doc: page,
      selectedId: null,
      history: { past: [], future: [] },
      refLayer: null,
      dirty: true,
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,
      viewEpoch: get().viewEpoch + 1,
    })
  },

  duplicatePage: (pageId) => {
    const { pages, activePageId } = get()
    const source = pages.find((p) => p.meta.id === (pageId ?? activePageId))
    if (!source) return
    const copy = snapshot(source)
    copy.meta = {
      ...copy.meta,
      id: uuid(),
      name: `${source.meta.name} 副本`,
    }
    // regenerate root tree ids via JSON clone already done; keep structure
    set({
      pages: [...pages, copy],
      activePageId: copy.meta.id,
      doc: copy,
      selectedId: null,
      dirty: true,
      history: { past: [], future: [] },
      refLayer: null,
    })
  },

  deletePage: (pageId) => {
    const { pages, activePageId } = get()
    if (pages.length <= 1) return
    const nextPages = pages.filter((p) => p.meta.id !== pageId)
    const switching = activePageId === pageId
    const nextActive = switching
      ? nextPages[Math.max(0, pages.findIndex((p) => p.meta.id === pageId) - 1)] ?? nextPages[0]
      : pages.find((p) => p.meta.id === activePageId) ?? nextPages[0]

    set({
      pages: nextPages,
      activePageId: nextActive.meta.id,
      doc: nextActive,
      selectedId: switching ? null : get().selectedId,
      history: switching ? { past: [], future: [] } : get().history,
      refLayer: switching ? null : get().refLayer,
      dirty: true,
    })
  },

  switchPage: (pageId) => {
    const { pages, activePageId, doc } = get()
    if (pageId === activePageId) return
    const target = pages.find((p) => p.meta.id === pageId)
    if (!target) return
    // persist current doc into pages before switch
    const synced = syncPages(pages, activePageId, doc)
    set({
      pages: synced,
      activePageId: target.meta.id,
      doc: synced.find((p) => p.meta.id === pageId) ?? target,
      selectedId: null,
      history: { past: [], future: [] },
      refLayer: null,
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,
      viewEpoch: get().viewEpoch + 1,
    })
  },

  applyLanhuCss: (cssText) => {
    const { selectedId, doc } = get()
    if (!selectedId) {
      return { ok: false, message: '请先选中一个元素' }
    }
    const node = findNode(doc.root, selectedId)
    if (!node) {
      return { ok: false, message: '未找到选中元素' }
    }
    const parsed = parseLanhuCss(cssText)
    if (!parsed.applied.length) {
      return { ok: false, message: '未识别到可用的 CSS 属性，请粘贴蓝湖样式代码' }
    }
    get().pushHistory()
    const patch = applyParsedCssToNode(node, parsed)
    const root = updateNodeInTree(doc.root, selectedId, (n) => ({
      ...n,
      ...patch,
      style: { ...n.style, ...patch.style },
      props: { ...n.props, ...patch.props },
    }))
    setDoc(set, get, { ...doc, root })
    const parts = [`已应用 ${parsed.applied.length} 项`]
    if (parsed.ignored.length) parts.push(`忽略 ${parsed.ignored.length} 项`)
    return { ok: true, message: parts.join('，') }
  },

  alignSelected: (mode) => {
    const { selectedId, doc } = get()
    if (!selectedId || selectedId === doc.root.id) return
    const node = findNode(doc.root, selectedId)
    if (!node) return
    const parent = findParent(doc.root, selectedId) ?? doc.root
    get().pushHistory()
    const patch = alignInParent(node, parent, mode)
    const root = updateNodeInTree(doc.root, selectedId, (n) => ({ ...n, ...patch }))
    setDoc(set, get, { ...doc, root })
  },
}))
