import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import './PageBar.css'

export function PageBar() {
  const pages = useEditorStore((s) => s.pages)
  const activePageId = useEditorStore((s) => s.activePageId)
  const addPage = useEditorStore((s) => s.addPage)
  const switchPage = useEditorStore((s) => s.switchPage)
  const deletePage = useEditorStore((s) => s.deletePage)
  const duplicatePage = useEditorStore((s) => s.duplicatePage)
  const renamePage = useEditorStore((s) => s.renamePage)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  const startRename = (id: string, name: string) => {
    setEditingId(id)
    setDraft(name)
  }

  const commitRename = () => {
    if (!editingId) return
    if (editingId === activePageId) {
      renamePage(draft)
    } else {
      // rename inactive page directly
      useEditorStore.setState((s) => ({
        pages: s.pages.map((p) =>
          p.meta.id === editingId
            ? { ...p, meta: { ...p.meta, name: draft.trim() || p.meta.name } }
            : p,
        ),
      }))
    }
    setEditingId(null)
  }

  return (
    <div className="page-bar">
      <div className="page-bar__scroll thin-scroll">
        {pages.map((page, index) => {
          const active = page.meta.id === activePageId
          return (
            <div
              key={page.meta.id}
              className={`page-tab${active ? ' is-active' : ''}`}
              onClick={() => switchPage(page.meta.id)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                startRename(page.meta.id, page.meta.name)
              }}
            >
              {editingId === page.meta.id ? (
                <input
                  ref={inputRef}
                  className="page-tab__input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <span className="page-tab__name" title="双击重命名">
                  {page.meta.name || `页面 ${index + 1}`}
                </span>
              )}
              <div className="page-tab__actions">
                <button
                  type="button"
                  title="复制页面"
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicatePage(page.meta.id)
                  }}
                >
                  ⧉
                </button>
                {pages.length > 1 ? (
                  <button
                    type="button"
                    title="删除页面"
                    onClick={(e) => {
                      e.stopPropagation()
                      deletePage(page.meta.id)
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
        <button type="button" className="page-bar__add" onClick={addPage} title="新建页面">
          ＋ 新建页面
        </button>
      </div>
    </div>
  )
}
