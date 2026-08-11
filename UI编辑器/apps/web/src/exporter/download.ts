import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { CssUnit, UINode } from '../schema/types'
import type { ExportAsset } from './assets'
import { exportHtmlCss } from './html'
import { exportReact } from './react'
import { exportVue } from './vue'

export type ExportZipFormat = 'html' | 'react' | 'vue'

export interface DownloadOptions {
  unit?: CssUnit
  designWidth?: number
  /** 按当前导出 Tab 打包，默认仅 HTML + CSS */
  format?: ExportZipFormat
}

export async function downloadExportZip(
  root: UINode,
  pageName: string,
  options: DownloadOptions = {},
) {
  const safe = pageName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_') || 'page'
  const designWidth = options.designWidth ?? root.width
  // 导出始终自适应；忽略编辑器里的 px 设置
  const exportOpts = { unit: 'rem' as const, designWidth }
  const format = options.format ?? 'html'
  const name = toPascal(safe)

  const zip = new JSZip()
  let assets: ExportAsset[] = []

  if (format === 'html') {
    const exported = exportHtmlCss(root, pageName, exportOpts)
    zip.file('index.html', exported.html)
    zip.file('styles.css', exported.css)
    assets = exported.assets
  } else if (format === 'react') {
    const exported = exportReact(root, name, exportOpts)
    zip.file(`${name}.tsx`, exported.code)
    assets = exported.assets
  } else {
    const exported = exportVue(root, name, exportOpts)
    zip.file(`${name}.vue`, exported.code)
    assets = exported.assets
  }

  for (const asset of assets) {
    zip.file(asset.path, asset.data)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const suffix = format === 'html' ? 'html-css' : format
  saveAs(blob, `${safe}-${suffix}.zip`)
}

function toPascal(name: string) {
  const cleaned = name.replace(/[^\w]+/g, ' ').trim()
  if (!cleaned) return 'ExportedPage'
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/^[0-9]/, 'Page')
}
