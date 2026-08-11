import { useEffect, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { VIEWPORT_PRESETS } from '../schema/viewports'
import { ExportModal } from './ExportModal'
import { FigmaImportModal } from './FigmaImportModal'
import './Toolbar.css'

interface Props {
  onSave?: () => void
  onBack?: () => void
  saving?: boolean
  saveMessage?: string
}

export function Toolbar({ onSave, onBack, saving, saveMessage }: Props) {
  const doc = useEditorStore((s) => s.doc)
  const projectName = useEditorStore((s) => s.projectName)
  const setProjectName = useEditorStore((s) => s.setProjectName)
  const dirty = useEditorStore((s) => s.dirty)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const deleteSelected = useEditorStore((s) => s.deleteSelected)
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected)
  const setViewport = useEditorStore((s) => s.setViewport)
  const setCssUnit = useEditorStore((s) => s.setCssUnit)
  const resetView = useEditorStore((s) => s.resetView)
  const alignSelected = useEditorStore((s) => s.alignSelected)
  const selectedId = useEditorStore((s) => s.selectedId)
  const history = useEditorStore((s) => s.history)
  const canAlign = !!selectedId && selectedId !== doc.root.id

  const [exportOpen, setExportOpen] = useState(false)
  const [figmaOpen, setFigmaOpen] = useState(false)
  const viewportId = doc.meta.viewportId ?? 'custom'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
        return

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelected()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, deleteSelected, duplicateSelected])

  return (
    <>
      <header className="toolbar">
        <div className="toolbar-left">
          <button type="button" className="toolbar-back" title="返回项目列表" onClick={onBack}>
            ← 项目
          </button>
          <input
            className="toolbar-title"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            title="项目名称"
          />
          {dirty ? <span className="toolbar-dirty">未保存</span> : null}
          <span className="toolbar-sep" />
          <label className="toolbar-viewport">
            <span>分辨率</span>
            <select
              value={VIEWPORT_PRESETS.some((v) => v.id === viewportId) ? viewportId : 'custom'}
              onChange={(e) => {
                const id = e.target.value
                if (id === 'custom') {
                  setViewport('custom', {
                    width: doc.root.width,
                    height: doc.root.height,
                  })
                } else {
                  setViewport(id)
                }
              }}
            >
              {VIEWPORT_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value="custom">
                自定义 {doc.root.width}×{doc.root.height}
              </option>
            </select>
          </label>
          <span className="toolbar-size">
            {doc.root.width} × {doc.root.height}
          </span>
          <label
            className="toolbar-viewport"
            title="px 固定尺寸；rem 随页面宽度缩放（改分辨率会等比缩放元素，导出为 rem）"
          >
            <span>单位</span>
            <select
              value={doc.meta.cssUnit === 'rem' ? 'rem' : 'px'}
              onChange={(e) => setCssUnit(e.target.value === 'rem' ? 'rem' : 'px')}
            >
              <option value="px">px（固定）</option>
              <option value="rem">rem（随页面缩放）</option>
            </select>
          </label>
        </div>

        <div className="toolbar-center">
          <button type="button" disabled={!history.past.length} onClick={undo} title="撤销 Ctrl+Z">
            撤销
          </button>
          <button type="button" disabled={!history.future.length} onClick={redo} title="重做 Ctrl+Y">
            重做
          </button>
          <span className="toolbar-sep" />
          <div className="toolbar-align" title="相对画板对齐">
            <button type="button" disabled={!canAlign} onClick={() => alignSelected('left')} title="左对齐">
              左
            </button>
            <button type="button" disabled={!canAlign} onClick={() => alignSelected('center')} title="水平居中">
              中
            </button>
            <button type="button" disabled={!canAlign} onClick={() => alignSelected('right')} title="右对齐">
              右
            </button>
            <button type="button" disabled={!canAlign} onClick={() => alignSelected('top')} title="顶对齐">
              顶
            </button>
            <button type="button" disabled={!canAlign} onClick={() => alignSelected('middle')} title="垂直居中">
              竖中
            </button>
            <button type="button" disabled={!canAlign} onClick={() => alignSelected('bottom')} title="底对齐">
              底
            </button>
          </div>
          <span className="toolbar-sep" />
          <button type="button" onClick={() => setZoom(zoom - 0.1)} title="缩小">
            −
          </button>
          <span className="toolbar-zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom(zoom + 0.1)} title="放大">
            ＋
          </button>
          <button type="button" onClick={resetView} title="重置视图 84% 居中">
            重置
          </button>
        </div>

        <div className="toolbar-right">
          {saveMessage ? <span className="toolbar-save-msg">{saveMessage}</span> : null}
          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={onSave}
            title="保存到后端 Ctrl+S"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setFigmaOpen(true)}>
            导入 Figma
          </button>
          <button type="button" className="btn-ghost" onClick={() => setExportOpen(true)}>
            导出代码
          </button>
        </div>
      </header>

      {exportOpen ? <ExportModal onClose={() => setExportOpen(false)} /> : null}
      {figmaOpen ? <FigmaImportModal onClose={() => setFigmaOpen(false)} /> : null}
    </>
  )
}
