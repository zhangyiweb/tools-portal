import { useEffect, useRef, useState } from 'react'
import type { NodeType, UINode } from '../schema/types'
import {
  ANTD_TYPES,
  BASIC_TYPES,
  ELEMENT_TYPES,
  TYPE_LABELS,
  findParent,
  isAncestorOf,
} from '../schema/defaults'
import {
  dropPositionFromOffset,
  resolveLayerDrop,
  type LayerDropPosition,
} from '../schema/layerDnD'
import { useEditorStore } from '../store/editorStore'
import { deleteProjectAsset, uploadProjectAssets, type ProjectAsset } from '../api/projects'
import { ASSET_DND_MIME, LAYER_DND_MIME, PALETTE_DND_MIME, type AssetDragPayload } from '../canvas/dnd'
import { getPaletteIcon, paletteIconTone } from './paletteIcons'
import { DeleteOutlined } from '@ant-design/icons'
import './LeftPanel.css'

type MainTab = 'components' | 'assets' | 'layers'
type LibTab = 'basic' | 'antd' | 'element'

const LIB_TABS: { id: LibTab; label: string; types: NodeType[] }[] = [
  { id: 'basic', label: '基础', types: BASIC_TYPES },
  { id: 'antd', label: 'Ant Design', types: ANTD_TYPES },
  { id: 'element', label: 'Element Plus', types: ELEMENT_TYPES },
]

export function LeftPanel() {
  const root = useEditorStore((s) => s.doc.root)
  const selectedId = useEditorStore((s) => s.selectedId)
  const addNode = useEditorStore((s) => s.addNode)
  const setSelected = useEditorStore((s) => s.setSelected)
  const reparentNode = useEditorStore((s) => s.reparentNode)
  const projectId = useEditorStore((s) => s.projectId)
  const assets = useEditorStore((s) => s.assets)
  const setAssets = useEditorStore((s) => s.setAssets)
  const addImageFromAsset = useEditorStore((s) => s.addImageFromAsset)
  const [mainTab, setMainTab] = useState<MainTab>('components')
  const [libTab, setLibTab] = useState<LibTab>('basic')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: string
    position: LayerDropPosition
  } | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const currentLib = LIB_TABS.find((t) => t.id === libTab)!

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAncestors = (nodeId: string) => {
    setCollapsedIds((prev) => {
      let changed = false
      const next = new Set(prev)
      let cur = findParent(root, nodeId)
      while (cur) {
        if (next.has(cur.id)) {
          next.delete(cur.id)
          changed = true
        }
        cur = findParent(root, cur.id)
      }
      return changed ? next : prev
    })
  }

  useEffect(() => {
    if (selectedId) expandAncestors(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅跟选中变化展开
  }, [selectedId])

  const dropToRootBlank = () => {
    if (!dragId) return
    const resolved = resolveLayerDrop(root, dragId, root.id, 'inside')
    const moving = dragId
    setDropTarget(null)
    setDragId(null)
    if (!resolved) return
    reparentNode(moving, resolved.parentId, resolved.index)
  }

  const handleLayerDrop = (id: string, position: LayerDropPosition) => {
    if (!dragId) return
    const resolved = resolveLayerDrop(root, dragId, id, position)
    const moving = dragId
    setDropTarget(null)
    setDragId(null)
    if (!resolved) return
    reparentNode(moving, resolved.parentId, resolved.index)
    if (position === 'inside') {
      setCollapsedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const onUploadAssets = async (files: FileList | null) => {
    if (!files?.length || !projectId) return
    setUploading(true)
    setUploadError('')
    try {
      const result = await uploadProjectAssets(projectId, files)
      setAssets(result.assets)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDeleteAsset = async (asset: ProjectAsset) => {
    if (!projectId) return
    try {
      await deleteProjectAsset(projectId, asset.id)
      setAssets(assets.filter((a) => a.id !== asset.id))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <aside className="left-panel">
      <div className="side-tabs side-tabs--3" role="tablist">
        <button
          type="button"
          role="tab"
          className={mainTab === 'components' ? 'is-active' : ''}
          aria-selected={mainTab === 'components'}
          onClick={() => setMainTab('components')}
        >
          组件
        </button>
        <button
          type="button"
          role="tab"
          className={mainTab === 'assets' ? 'is-active' : ''}
          aria-selected={mainTab === 'assets'}
          onClick={() => setMainTab('assets')}
        >
          切图
        </button>
        <button
          type="button"
          role="tab"
          className={mainTab === 'layers' ? 'is-active' : ''}
          aria-selected={mainTab === 'layers'}
          onClick={() => setMainTab('layers')}
        >
          图层
        </button>
      </div>

      {mainTab === 'components' ? (
        <div className="left-panel__body">
          <div className="lib-tabs" role="tablist">
            {LIB_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={libTab === tab.id ? 'is-active' : ''}
                aria-selected={libTab === tab.id}
                onClick={() => setLibTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="left-panel__scroll thin-scroll">
            <p className="palette-hint">点击或拖到画布添加</p>
            <div className="palette-grid">
              {currentLib.types.map((type) => (
                <PaletteItem key={type} type={type} onAdd={() => addNode(type)} />
              ))}
            </div>
          </div>
        </div>
      ) : mainTab === 'assets' ? (
        <div className="left-panel__body">
          <div className="left-panel__scroll thin-scroll">
            <p className="palette-hint">批量上传切图后，拖到画布即可放置</p>
            <div className="asset-toolbar">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => void onUploadAssets(e.target.files)}
              />
              <button
                type="button"
                className="asset-upload-btn"
                disabled={!projectId || uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? '上传中…' : '批量上传切图'}
              </button>
            </div>
            {uploadError ? <p className="asset-error">{uploadError}</p> : null}
            {assets.length === 0 ? (
              <p className="palette-hint">暂无切图</p>
            ) : (
              <div className="asset-grid">
                {assets.map((asset) => (
                  <AssetItem
                    key={asset.id}
                    asset={asset}
                    onInsert={() => addImageFromAsset({ url: asset.url, name: asset.name })}
                    onDelete={() => void onDeleteAsset(asset)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="left-panel__body">
          <div className="left-panel__scroll thin-scroll left-panel__scroll--layers">
            <p className="palette-hint">
              拖到图层中间可嵌套；拖到下方空白处可移出嵌套，成为画布直接子节点
            </p>
            <div className="layer-tree">
              <LayerItem
                node={root}
                depth={0}
                root={root}
                selectedId={selectedId}
                dragId={dragId}
                dropTarget={dropTarget}
                collapsedIds={collapsedIds}
                onSelect={setSelected}
                onToggleCollapse={toggleCollapse}
                onDragStart={(id) => setDragId(id)}
                onDragEnd={() => {
                  setDragId(null)
                  setDropTarget(null)
                }}
                onDragOverTarget={(id, position) => setDropTarget({ id, position })}
                onClearDropTarget={() => setDropTarget(null)}
                onDropOnTarget={handleLayerDrop}
              />
              <div
                className={`layer-tree__blank${
                  dropTarget?.id === '__blank__' ? ' layer-tree__blank--active' : ''
                }${dragId ? ' layer-tree__blank--ready' : ''}`}
                onDragOver={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  setDropTarget({ id: '__blank__', position: 'inside' })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dropTarget?.id === '__blank__') setDropTarget(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  dropToRootBlank()
                }}
              >
                {dragId ? '放到此处 → 画布直接子节点' : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function AssetItem({
  asset,
  onInsert,
  onDelete,
}: {
  asset: ProjectAsset
  onInsert: () => void
  onDelete: () => void
}) {
  return (
    <div className="asset-item" title={`${asset.name}（拖到画布或点击插入）`}>
      <div
        className="asset-item__thumb"
        draggable
        onDragStart={(e) => {
          const payload: AssetDragPayload = { url: asset.url, name: asset.name }
          e.dataTransfer.setData(ASSET_DND_MIME, JSON.stringify(payload))
          e.dataTransfer.setData('text/plain', asset.url)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={onInsert}
      >
        <img src={asset.url} alt={asset.name} draggable={false} />
        <button
          type="button"
          className="asset-item__delete"
          title="删除切图"
          aria-label="删除切图"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DeleteOutlined />
        </button>
      </div>
      <div className="asset-item__meta">
        <span className="asset-item__name">{asset.name}</span>
      </div>
    </div>
  )
}

function PaletteItem({ type, onAdd }: { type: NodeType; onAdd: () => void }) {
  const label = TYPE_LABELS[type]
  const Icon = getPaletteIcon(type)
  const tone = paletteIconTone(type)

  return (
    <button
      type="button"
      className={`palette-item${Icon ? '' : ' palette-item--text-only'}`}
      title={`点击添加，或拖到画布：${label}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DND_MIME, type)
        e.dataTransfer.setData('text/plain', type)
        e.dataTransfer.effectAllowed = 'copy'
        e.currentTarget.classList.add('is-dragging')
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('is-dragging')
      }}
      onClick={onAdd}
    >
      {Icon ? (
        <span className={`palette-icon palette-icon--${tone}`}>
          <Icon />
        </span>
      ) : null}
      <span className="palette-label">{label}</span>
    </button>
  )
}

function LayerItem({
  node,
  depth,
  root,
  selectedId,
  dragId,
  dropTarget,
  collapsedIds,
  onSelect,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
  onDragOverTarget,
  onClearDropTarget,
  onDropOnTarget,
}: {
  node: UINode
  depth: number
  root: UINode
  selectedId: string | null
  dragId: string | null
  dropTarget: { id: string; position: LayerDropPosition } | null
  collapsedIds: Set<string>
  onSelect: (id: string) => void
  onToggleCollapse: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragOverTarget: (id: string, position: LayerDropPosition) => void
  onClearDropTarget: () => void
  onDropOnTarget: (id: string, position: LayerDropPosition) => void
}) {
  const isRoot = depth === 0
  const childCount = node.children?.length ?? 0
  const hasChildren = childCount > 0
  const expanded = !collapsedIds.has(node.id)
  const lib = node.type.startsWith('antd-')
    ? 'antd'
    : node.type.startsWith('el-')
      ? 'el'
      : ''

  const isDrop = dropTarget?.id === node.id
  const dropClass = isDrop ? ` layer-item--drop-${dropTarget.position}` : ''
  const dragging = dragId === node.id

  return (
    <>
      <div
        className={`layer-item${selectedId === node.id ? ' layer-item--active' : ''}${
          dragging ? ' layer-item--dragging' : ''
        }${dropClass}`}
        style={{ paddingLeft: 4 + depth * 12 }}
        draggable={!isRoot}
        onClick={() => onSelect(node.id)}
        onDragStart={(e) => {
          if (isRoot) {
            e.preventDefault()
            return
          }
          e.stopPropagation()
          e.dataTransfer.setData(LAYER_DND_MIME, node.id)
          e.dataTransfer.setData('text/plain', node.id)
          e.dataTransfer.effectAllowed = 'move'
          onDragStart(node.id)
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          if (!dragId || dragId === node.id) return
          if (isAncestorOf(root, dragId, node.id)) return
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
          const rect = e.currentTarget.getBoundingClientRect()
          const position = isRoot
            ? 'inside'
            : dropPositionFromOffset(e.clientY - rect.top, rect.height, true)
          onDragOverTarget(node.id, position)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            if (dropTarget?.id === node.id) onClearDropTarget()
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!dragId || dragId === node.id) return
          if (isAncestorOf(root, dragId, node.id)) return
          const rect = e.currentTarget.getBoundingClientRect()
          const position = isRoot
            ? 'inside'
            : dropPositionFromOffset(e.clientY - rect.top, rect.height, true)
          onDropOnTarget(node.id, position)
        }}
        title={isRoot ? '画布根节点（可拖入子图层）' : '拖拽调整顺序或嵌套'}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`layer-toggle${expanded ? ' is-expanded' : ''}`}
            aria-label={expanded ? '折叠' : '展开'}
            title={expanded ? '折叠' : '展开'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(node.id)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="layer-toggle layer-toggle--spacer" aria-hidden />
        )}
        <span className="layer-type">
          {lib ? `${lib}/` : ''}
          {TYPE_LABELS[node.type]}
        </span>
        <span className="layer-name">{node.name}</span>
        {hasChildren ? <span className="layer-count">{childCount}</span> : null}
      </div>
      {hasChildren && expanded
        ? node.children!.map((child) => (
            <LayerItem
              key={child.id}
              node={child}
              depth={depth + 1}
              root={root}
              selectedId={selectedId}
              dragId={dragId}
              dropTarget={dropTarget}
              collapsedIds={collapsedIds}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverTarget={onDragOverTarget}
              onClearDropTarget={onClearDropTarget}
              onDropOnTarget={onDropOnTarget}
            />
          ))
        : null}
    </>
  )
}
