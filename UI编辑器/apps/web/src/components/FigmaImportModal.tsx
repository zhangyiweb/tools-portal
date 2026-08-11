import { useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { importFigmaFile } from '../importer/figma/client'
import './Modal.css'

interface Props {
  onClose: () => void
}

export function FigmaImportModal({ onClose }: Props) {
  const loadDocument = useEditorStore((s) => s.loadDocument)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onImport = async () => {
    setError(null)
    setLoading(true)
    try {
      const doc = await importFigmaFile(url.trim(), token.trim())
      loadDocument(doc)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导入 Figma</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            粘贴 Figma 文件链接与 Personal Access Token。服务端会代理 Figma API 并映射为可编辑节点树。
          </p>
          <label className="prop-field">
            <span>Figma 文件 URL</span>
            <input
              placeholder="https://www.figma.com/file/xxxxx/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label className="prop-field">
            <span>Personal Access Token</span>
            <input
              type="password"
              placeholder="figd_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          {error ? <p className="modal-error">{error}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !url || !token}
            onClick={onImport}
          >
            {loading ? '导入中…' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
