import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ResizeHandle, UINode } from '../schema/types'
import { findNode, findParent } from '../schema/defaults'
import { NodeRenderer } from '../nodes/NodeRenderer'
import { useEditorStore } from '../store/editorStore'
import { SelectionOverlay } from './SelectionOverlay'
import { AlignGuides } from './AlignGuides'
import { collectSnapLines, snapPosition, snapResize, type AlignGuide } from './snap'
import { DEFAULT_ZOOM, getCenteredPan } from './view'
import { PALETTE_DND_MIME, ASSET_DND_MIME, type AssetDragPayload } from './dnd'
import type { NodeType } from '../schema/types'
import './Canvas.css'

type DragMode =
  | {
      type: 'move'
      startX: number
      startY: number
      origX: number
      origY: number
      id: string
      width: number
      height: number
    }
  | {
      type: 'resize'
      handle: ResizeHandle
      startX: number
      startY: number
      id: string
      orig: { x: number; y: number; width: number; height: number }
    }
  | {
      type: 'pan'
      startX: number
      startY: number
      origPanX: number
      origPanY: number
    }
  | null

export function Canvas() {
  const doc = useEditorStore((s) => s.doc)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const selectedId = useEditorStore((s) => s.selectedId)
  const refLayer = useEditorStore((s) => s.refLayer)
  const setSelected = useEditorStore((s) => s.setSelected)
  const setPan = useEditorStore((s) => s.setPan)
  const setZoom = useEditorStore((s) => s.setZoom)
  const viewEpoch = useEditorStore((s) => s.viewEpoch)
  const pushHistory = useEditorStore((s) => s.pushHistory)
  const addNode = useEditorStore((s) => s.addNode)
  const addImageFromAsset = useEditorStore((s) => s.addImageFromAsset)

  const dragRef = useRef<DragMode>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [panning, setPanning] = useState(false)
  const [guides, setGuides] = useState<AlignGuide[]>([])
  const [dropActive, setDropActive] = useState(false)

  const selectedAbs = selectedId ? getAbsoluteRect(doc.root, selectedId) : null

  const centerArtboard = useCallback(
    (nextZoom = DEFAULT_ZOOM) => {
      const el = viewportRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const { panX: x, panY: y } = getCenteredPan(
        rect.width,
        rect.height,
        doc.root.width,
        doc.root.height,
        nextZoom,
      )
      setZoom(nextZoom)
      setPan(x, y)
    },
    [doc.root.width, doc.root.height, setPan, setZoom],
  )

  useLayoutEffect(() => {
    centerArtboard(DEFAULT_ZOOM)
  }, [doc.meta.id, doc.root.width, doc.root.height, viewEpoch, centerArtboard])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      // 捕获阶段拦截，避免内部可滚动组件抢走滚轮
      e.preventDefault()
      e.stopPropagation()

      const rect = el.getBoundingClientRect()
      const anchorX = e.clientX - rect.left
      const anchorY = e.clientY - rect.top
      const currentZoom = useEditorStore.getState().zoom

      // 统一成像素增量，兼容鼠标滚轮 / 触控板
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      if (e.deltaMode === 2) dy *= rect.height

      const factor = Math.exp(-dy * 0.0015)
      useEditorStore.getState().zoomAt(currentZoom * factor, anchorX, anchorY)
    }
    el.addEventListener('wheel', handler, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', handler, { capture: true })
  }, [])

  const beginMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        startPan(e)
        return
      }
      if (e.button !== 0) return

      const target = (e.target as HTMLElement).closest('[data-node-id]') as HTMLElement | null
      const id = target?.dataset.nodeId

      if (!id || id === doc.root.id) {
        setSelected(null)
        startPan(e)
        return
      }

      setSelected(id)
      const node = findNode(doc.root, id)
      if (!node || node.locked) return

      pushHistory()
      dragRef.current = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        origX: node.x,
        origY: node.y,
        width: node.width,
        height: node.height,
        id,
      }
    },
    [doc.root, setSelected, pushHistory],
  )

  function startPan(e: React.PointerEvent | PointerEvent) {
    const { panX: px, panY: py } = useEditorStore.getState()
    dragRef.current = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      origPanX: px,
      origPanY: py,
    }
    setPanning(true)
  }

  const beginResize = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (!selectedId || selectedId === doc.root.id) return
      const node = findNode(doc.root, selectedId)
      if (!node) return
      pushHistory()
      dragRef.current = {
        type: 'resize',
        handle,
        startX: e.clientX,
        startY: e.clientY,
        id: selectedId,
        orig: { x: node.x, y: node.y, width: node.width, height: node.height },
      }
    },
    [selectedId, doc.root, pushHistory],
  )

  useEffect(() => {
    const toAbsGuides = (id: string, local: AlignGuide[]): AlignGuide[] => {
      const root = useEditorStore.getState().doc.root
      const parent = findParent(root, id)
      const parentAbs = parent ? getAbsoluteRect(root, parent.id) : { x: 0, y: 0 }
      const ox = parentAbs?.x ?? 0
      const oy = parentAbs?.y ?? 0
      return local.map((g) => ({
        ...g,
        position: g.orientation === 'v' ? g.position + ox : g.position + oy,
      }))
    }

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (drag.type === 'pan') {
        setPan(drag.origPanX + (e.clientX - drag.startX), drag.origPanY + (e.clientY - drag.startY))
        return
      }

      const dx = (e.clientX - drag.startX) / zoom
      const dy = (e.clientY - drag.startY) / zoom
      const root = useEditorStore.getState().doc.root
      const { xs, ys } = collectSnapLines(root, drag.id)
      const threshold = 6 / zoom

      if (drag.type === 'move') {
        const proposed = {
          x: drag.origX + dx,
          y: drag.origY + dy,
          width: drag.width,
          height: drag.height,
        }
        const snapped = snapPosition(proposed, xs, ys, threshold)
        patchNode(drag.id, { x: snapped.x, y: snapped.y })
        setGuides(toAbsGuides(drag.id, snapped.guides))
      } else if (drag.type === 'resize') {
        const resized = applyResizeFromOrig(drag.orig, drag.handle, dx, dy)
        const snapped = snapResize(resized, drag.handle, xs, ys, threshold)
        patchNode(drag.id, snapped.rect)
        setGuides(toAbsGuides(drag.id, snapped.guides))
      }
    }

    const onUp = () => {
      dragRef.current = null
      setPanning(false)
      setGuides([])
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [zoom, setPan])

  const viewportClass = [
    'canvas-viewport',
    panning ? 'canvas-viewport--panning' : '',
    dropActive ? 'canvas-viewport--drop' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropActive(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const { zoom: z, panX: px, panY: py, doc: current } = useEditorStore.getState()
    const worldX = (e.clientX - rect.left - px) / z
    const worldY = (e.clientY - rect.top - py) / z

    const assetRaw = e.dataTransfer.getData(ASSET_DND_MIME)
    if (assetRaw) {
      try {
        const asset = JSON.parse(assetRaw) as AssetDragPayload
        if (asset.url) {
          addImageFromAsset(asset, { x: worldX, y: worldY })
          return
        }
      } catch {
        /* fall through */
      }
    }

    const type = (e.dataTransfer.getData(PALETTE_DND_MIME) || e.dataTransfer.getData('text/plain')) as NodeType
    if (!type || type.includes('/') || type.startsWith('http') || type.startsWith('data:')) return
    addNode(type, current.root.id, { x: worldX, y: worldY })
  }

  return (
    <div
      ref={viewportRef}
      className={viewportClass}
      onPointerDown={beginMove}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={() => setDropActive(false)}
    >
      <div
        className="canvas-world"
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
      >
        <div
          className={`canvas-artboard${!doc.root.children?.length ? ' canvas-artboard--empty' : ''}`}
          style={{ width: doc.root.width, height: doc.root.height }}
        >
          <div className="canvas-artboard__clip">
            {refLayer?.visible && refLayer.src ? (
              <img
                className="canvas-ref-layer"
                src={refLayer.src}
                alt="参考图层"
                style={{
                  opacity: refLayer.opacity,
                  transform: `translate(${refLayer.offsetX}px, ${refLayer.offsetY}px)`,
                }}
                draggable={false}
              />
            ) : null}
            <NodeRenderer node={doc.root} isRoot />
          </div>
        </div>
        {selectedAbs && selectedId && selectedId !== doc.root.id ? (
          <SelectionOverlay rect={selectedAbs} onResizeStart={beginResize} />
        ) : null}
        <AlignGuides
          guides={guides}
          bounds={{ width: doc.root.width, height: doc.root.height }}
        />
      </div>
    </div>
  )
}

function patchNode(id: string, patch: Partial<UINode>) {
  useEditorStore.setState((s) => {
    const doc = {
      ...s.doc,
      root: updateLocal(s.doc.root, id, patch),
    }
    return {
      doc,
      pages: s.pages.map((p) => (p.meta.id === s.activePageId ? doc : p)),
    }
  })
}

function getAbsoluteRect(
  root: UINode,
  id: string,
): { x: number; y: number; width: number; height: number } | null {
  const path: UINode[] = []
  function walk(node: UINode, trail: UINode[]): boolean {
    if (node.id === id) {
      path.push(...trail, node)
      return true
    }
    for (const c of node.children ?? []) {
      if (walk(c, [...trail, node])) return true
    }
    return false
  }
  if (!walk(root, [])) return null
  let x = 0
  let y = 0
  for (let i = 1; i < path.length; i++) {
    x += path[i].x
    y += path[i].y
  }
  const node = path[path.length - 1]
  return { x, y, width: node.width, height: node.height }
}

function applyResizeFromOrig(
  orig: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
) {
  let { x, y, width, height } = orig
  const min = 8
  if (handle.includes('e')) width = Math.max(min, orig.width + dx)
  if (handle.includes('s')) height = Math.max(min, orig.height + dy)
  if (handle.includes('w')) {
    width = Math.max(min, orig.width - dx)
    x = orig.x + (orig.width - width)
  }
  if (handle.includes('n')) {
    height = Math.max(min, orig.height - dy)
    y = orig.y + (orig.height - height)
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

function updateLocal(root: UINode, id: string, patch: Partial<UINode>): UINode {
  if (root.id === id) return { ...root, ...patch }
  if (!root.children) return root
  return {
    ...root,
    children: root.children.map((c) => updateLocal(c, id, patch)),
  }
}
