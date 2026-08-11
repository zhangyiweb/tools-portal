import type { CssUnit, UINode } from '../schema/types'
import { stylePropsToCssText } from '../schema/styleUtils'
import { formatLength, remRootFontSizeCss, resolveExportUnit } from '../schema/units'
import { materializeImageAssets, type ExportAsset } from './assets'

export interface ExportOptions {
  /** 默认 rem（随视口自适应）；传 px 则固定像素 */
  unit?: CssUnit
  /** 设计稿宽度，rem 模式下用于生成自适应根字号 */
  designWidth?: number
}

function classNameFor(node: UINode, indexPath: string): string {
  return `n-${node.type}-${indexPath}`
}

function walkCss(
  node: UINode,
  indexPath: string,
  isRoot: boolean,
  lines: string[],
  unit: CssUnit,
) {
  const cls = classNameFor(node, indexPath)
  const len = (n: number) => formatLength(n, unit)
  const layout = isRoot
    ? {
        position: 'relative',
        width: unit === 'rem' ? '100%' : len(node.width),
        height: len(node.height),
        'box-sizing': 'border-box',
        ...(unit === 'rem' ? { 'max-width': '100vw', overflow: 'hidden' } : {}),
      }
    : {
        position: 'absolute',
        left: len(node.x),
        top: len(node.y),
        width: len(node.width),
        height: len(node.height),
        'box-sizing': 'border-box',
      }

  const css = stylePropsToCssText(node.style, layout as Record<string, string>, { unit })
  lines.push(`.${cls} { ${css} }`)

  if (node.type === 'text' || node.type === 'button') {
    lines.push(
      `.${cls} .inner { width: 100%; height: 100%; display: flex; align-items: ${node.type === 'button' ? 'center' : 'flex-start'}; justify-content: ${node.style.textAlign === 'center' ? 'center' : node.style.textAlign === 'right' ? 'flex-end' : 'flex-start'}; white-space: pre-wrap; word-break: break-word; overflow: hidden; }`,
    )
  }
  if (node.type === 'input') {
    lines.push(
      `.${cls} .inner { width: 100%; height: 100%; display: flex; align-items: center; color: #9ca3af; overflow: hidden; }`,
    )
  }
  if (node.type === 'image') {
    lines.push(
      `.${cls} img { width: 100%; height: 100%; object-fit: ${node.style.objectFit ?? 'cover'}; object-position: ${node.style.objectPosition ?? 'center'}; display: block; }`,
    )
  }

  node.children?.forEach((child, i) => walkCss(child, `${indexPath}-${i}`, false, lines, unit))
}

function walkHtml(node: UINode, indexPath: string): string {
  const cls = classNameFor(node, indexPath)
  const kids = node.children?.map((c, i) => walkHtml(c, `${indexPath}-${i}`)).join('\n') ?? ''
  const p = node.props ?? {}

  switch (node.type) {
    case 'text':
      return `<div class="${cls}"><div class="inner">${escapeHtml(p.text ?? '')}</div>${kids}</div>`
    case 'rect':
    case 'frame':
      return `<div class="${cls}">${kids}</div>`
    case 'button':
      return `<button class="${cls}" type="button"><span class="inner">${escapeHtml(p.text ?? '按钮')}</span>${kids}</button>`
    case 'input':
      return `<div class="${cls}"><div class="inner">${escapeHtml(p.placeholder ?? '')}</div>${kids}</div>`
    case 'image':
      return `<div class="${cls}"><img src="${escapeAttr(p.src || 'https://via.placeholder.com/200')}" alt="${escapeAttr(p.alt ?? '')}" />${kids}</div>`
    case 'antd-button':
    case 'el-button':
      return `<button class="${cls}" type="button">${escapeHtml(p.text ?? '按钮')}</button>`
    case 'antd-input':
    case 'el-input':
    case 'antd-date-picker':
    case 'el-date-picker':
      return `<div class="${cls}">${escapeHtml(p.placeholder ?? '')}</div>`
    case 'antd-select':
    case 'el-select':
      return `<div class="${cls}">${escapeHtml(p.placeholder ?? '请选择')}</div>`
    case 'antd-tag':
    case 'el-tag':
      return `<span class="${cls}">${escapeHtml(p.text ?? 'Tag')}</span>`
    case 'antd-card':
    case 'el-card':
      return `<div class="${cls}"><strong>${escapeHtml(p.title ?? '')}</strong><div>${escapeHtml(p.text ?? '')}</div>${kids}</div>`
    case 'antd-checkbox':
    case 'el-checkbox':
    case 'antd-radio':
    case 'el-radio':
      return `<label class="${cls}">${escapeHtml(p.text ?? '')}</label>`
    case 'antd-switch':
    case 'el-switch':
      return `<div class="${cls}">switch</div>`
    case 'antd-table':
    case 'el-table':
      return `<div class="${cls}">表格</div>`
    default:
      if (node.type.startsWith('antd-') || node.type.startsWith('el-')) {
        return `<div class="${cls}">${escapeHtml(p.text ?? p.title ?? p.placeholder ?? node.name)}</div>`
      }
      return `<div class="${cls}">${kids}</div>`
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

export function exportHtmlCss(
  root: UINode,
  title = 'Exported Page',
  options: ExportOptions = {},
): { html: string; css: string; assets: ExportAsset[] } {
  const { root: tree, assets } = materializeImageAssets(root)
  const unit = resolveExportUnit(options.unit)
  const designWidth = options.designWidth ?? tree.width
  const cssLines: string[] = [`* { margin: 0; padding: 0; box-sizing: border-box; }`]
  if (unit === 'rem') {
    cssLines.push(remRootFontSizeCss(designWidth))
    cssLines.push(
      `html, body { width: 100%; margin: 0; padding: 0; }`,
      `body { background: #f3f4f6; font-family: system-ui, sans-serif; overflow-x: hidden; }`,
    )
  } else {
    cssLines.push(
      `body { background: #f3f4f6; display: flex; justify-content: center; padding: 24px; font-family: system-ui, sans-serif; }`,
    )
  }
  walkCss(tree, '0', true, cssLines, unit)
  const htmlBody = walkHtml(tree, '0')
  const css = cssLines.join('\n')
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
${htmlBody}
</body>
</html>`

  return { html, css, assets }
}
