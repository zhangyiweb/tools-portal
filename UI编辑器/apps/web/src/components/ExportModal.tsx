import { useMemo, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { exportHtmlCss } from '../exporter/html'
import { exportReact } from '../exporter/react'
import { exportVue } from '../exporter/vue'
import { downloadExportZip } from '../exporter/download'
import './Modal.css'

interface Props {
  onClose: () => void
}

type Tab = 'html' | 'react' | 'vue'

const TABS: { id: Tab; label: string }[] = [
  { id: 'html', label: 'HTML + CSS' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
]

export function ExportModal({ onClose }: Props) {
  const doc = useEditorStore((s) => s.doc)
  const [tab, setTab] = useState<Tab>('html')
  const [copied, setCopied] = useState(false)

  const exportOpts = useMemo(
    () => ({ unit: 'rem' as const, designWidth: doc.root.width }),
    [doc.root.width],
  )

  const { html, css } = useMemo(
    () => exportHtmlCss(doc.root, doc.meta.name, exportOpts),
    [doc.root, doc.meta.name, exportOpts],
  )
  const reactCode = useMemo(
    () => exportReact(doc.root, 'ExportedPage', exportOpts).code,
    [doc.root, exportOpts],
  )
  const vueCode = useMemo(
    () => exportVue(doc.root, 'ExportedPage', exportOpts).code,
    [doc.root, exportOpts],
  )

  const contentByTab: Record<Tab, string> = {
    html: `<!-- index.html -->\n${html}\n\n/* styles.css */\n${css}`,
    react: reactCode,
    vue: vueCode,
  }

  const copyTextByTab: Record<Tab, string> = {
    html: `${html}\n\n${css}`,
    react: reactCode,
    vue: vueCode,
  }

  const copy = async () => {
    await navigator.clipboard.writeText(copyTextByTab[tab])
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导出代码</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="modal-unit-hint">
          导出为 <strong>rem</strong> 自适应布局：按设计稿宽度（{doc.root.width}px）等比缩放，可在手机、平板、桌面等不同分辨率下正常展示
        </p>
        <div className="modal-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <pre className="modal-code">{contentByTab[tab]}</pre>
        <div className="modal-actions">
          <button type="button" onClick={copy}>
            {copied ? '已复制' : '复制代码'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              downloadExportZip(doc.root, doc.meta.name, { ...exportOpts, format: tab })
            }
          >
            {tab === 'html'
              ? '下载 HTML+CSS ZIP'
              : tab === 'react'
                ? '下载 React ZIP'
                : '下载 Vue ZIP'}
          </button>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
