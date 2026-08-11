import type { CssUnit, StyleProps, UINode } from '../schema/types'
import { convertPxInCssValue, formatLength, remRootFontSizeCss, resolveExportUnit } from '../schema/units'
import type { ExportOptions } from './html'
import { materializeImageAssets, type ExportAsset } from './assets'

function styleObjectCss(style: StyleProps, layout: Record<string, string | number>, unit: CssUnit): string {
  const len = (n: number) => formatLength(n, unit)
  const lengthOrRaw = (v: string | number | undefined) => {
    if (v == null) return undefined
    if (typeof v === 'string') return v
    return len(v)
  }
  const map: Record<string, string | number | undefined> = {
    position: layout.position,
    left: lengthOrRaw(layout.left as string | number | undefined),
    top: lengthOrRaw(layout.top as string | number | undefined),
    width: lengthOrRaw(layout.width as string | number | undefined),
    height: lengthOrRaw(layout.height as string | number | undefined),
    'box-sizing': 'border-box',
    'max-width': lengthOrRaw(layout.maxWidth as string | number | undefined),
    overflow: layout.overflow as string | undefined,
    background: style.backgroundImage ? undefined : style.background,
    'background-color': style.backgroundImage
      ? style.backgroundColor
      : style.background
        ? undefined
        : style.backgroundColor,
    'background-image': style.backgroundImage
      ? /^url\(/i.test(style.backgroundImage)
        ? style.backgroundImage
        : `url("${style.backgroundImage.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
      : undefined,
    'background-size': style.backgroundImage
      ? (style.backgroundSize ?? 'cover')
      : undefined,
    'background-position': style.backgroundImage
      ? (style.backgroundPosition ?? 'center')
      : undefined,
    'background-repeat': style.backgroundImage
      ? (style.backgroundRepeat ?? 'no-repeat')
      : undefined,
    color: style.color,
    'font-size': style.fontSize != null ? len(style.fontSize) : undefined,
    'font-weight': style.fontWeight,
    'font-family': style.fontFamily,
    'line-height':
      typeof style.lineHeight === 'number' ? len(style.lineHeight) : style.lineHeight,
    'letter-spacing': style.letterSpacing != null ? len(style.letterSpacing) : undefined,
    'text-align': style.textAlign,
    'border-radius': style.borderRadius != null ? len(style.borderRadius) : undefined,
    'border-width': style.borderWidth != null ? len(style.borderWidth) : undefined,
    'border-style': style.borderWidth != null ? (style.borderStyle ?? 'solid') : undefined,
    'border-color': style.borderWidth != null ? (style.borderColor ?? '#000') : undefined,
    opacity: style.opacity,
    'box-shadow': style.boxShadow ? convertPxInCssValue(style.boxShadow, unit) : undefined,
    padding: style.padding != null ? len(style.padding) : undefined,
    margin: style.margin != null ? len(style.margin) : undefined,
    'object-fit': style.objectFit,
    'object-position': style.objectPosition,
    'z-index': style.zIndex,
  }

  return Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

function layoutOf(node: UINode, isRoot: boolean, unit: CssUnit): Record<string, string | number> {
  if (isRoot) {
    return {
      position: 'relative',
      width: unit === 'rem' ? '100%' : node.width,
      height: node.height,
      ...(unit === 'rem' ? { maxWidth: '100vw', overflow: 'hidden' } : {}),
    }
  }
  return {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderNode(node: UINode, isRoot: boolean, indent: number, unit: CssUnit): string {
  const pad = '  '.repeat(indent)
  const style = styleObjectCss(node.style, layoutOf(node, isRoot, unit), unit)
  const kids = node.children?.map((c) => renderNode(c, false, indent + 1, unit)).join('\n') ?? ''
  const p = node.props ?? {}

  switch (node.type) {
    case 'text':
      return `${pad}<div style="${style}">\n${pad}  <div style="width: 100%; height: 100%; white-space: pre-wrap; word-break: break-word; overflow: hidden">${escapeHtml(p.text ?? '')}</div>\n${kids ? `${kids}\n` : ''}${pad}</div>`
    case 'rect':
    case 'frame':
      return `${pad}<div style="${style}">\n${kids}\n${pad}</div>`
    case 'button':
    case 'antd-button':
    case 'el-button':
      return `${pad}<button type="button" style="${style}">${escapeHtml(p.text ?? '按钮')}</button>`
    case 'input':
    case 'antd-input':
    case 'el-input':
      return `${pad}<input placeholder="${escapeHtml(p.placeholder ?? '')}" style="${style}" />`
    case 'image':
      return `${pad}<div style="${style}">\n${pad}  <img src="${escapeHtml(p.src || '')}" alt="${escapeHtml(p.alt ?? '')}" style="width: 100%; height: 100%; object-fit: ${node.style.objectFit ?? 'cover'}; display: block" />\n${pad}</div>`
    case 'antd-select':
    case 'el-select':
      return `${pad}<select style="${style}"><option disabled selected>${escapeHtml(p.placeholder ?? '请选择')}</option></select>`
    case 'antd-tag':
    case 'el-tag':
      return `${pad}<span style="${style}">${escapeHtml(p.text ?? 'Tag')}</span>`
    case 'antd-card':
    case 'el-card':
      return `${pad}<div style="${style}">\n${pad}  <div style="font-weight: 600; margin-bottom: 8px">${escapeHtml(p.title ?? '')}</div>\n${pad}  <div>${escapeHtml(p.text ?? '')}</div>\n${kids ? `${kids}\n` : ''}${pad}</div>`
    case 'antd-checkbox':
    case 'el-checkbox':
      return `${pad}<label style="${style}"><input type="checkbox"${p.checked ? ' checked' : ''} /> ${escapeHtml(p.text ?? '')}</label>`
    case 'antd-radio':
    case 'el-radio':
      return `${pad}<label style="${style}"><input type="radio"${p.checked ? ' checked' : ''} /> ${escapeHtml(p.text ?? '')}</label>`
    case 'antd-switch':
    case 'el-switch':
      return `${pad}<input type="checkbox" role="switch"${p.checked ? ' checked' : ''} style="${style}" />`
    case 'antd-date-picker':
    case 'el-date-picker':
      return `${pad}<input type="date" placeholder="${escapeHtml(p.placeholder ?? '')}" style="${style}" />`
    case 'antd-table':
    case 'el-table':
      return `${pad}<table style="${style}"><thead><tr><th>姓名</th><th>年龄</th><th>地址</th></tr></thead><tbody><tr><td>张三</td><td>28</td><td>上海</td></tr></tbody></table>`
    default:
      if (node.type.startsWith('antd-') || node.type.startsWith('el-')) {
        return `${pad}<div style="${style}">${escapeHtml(p.text ?? p.title ?? p.placeholder ?? node.name)}</div>`
      }
      return `${pad}<div style="${style}">\n${kids}\n${pad}</div>`
  }
}

/** 导出原生 Vue 3 SFC（不依赖 UI 库） */
export function exportVue(
  root: UINode,
  componentName = 'ExportedPage',
  options: ExportOptions = {},
): { code: string; assets: ExportAsset[] } {
  const { root: tree, assets } = materializeImageAssets(root)
  const unit = resolveExportUnit(options.unit)
  const designWidth = options.designWidth ?? tree.width
  const body = renderNode(tree, true, 1, unit)
  const remStyle =
    unit === 'rem'
      ? `
<style>
${remRootFontSizeCss(designWidth)}
</style>
`
      : ''

  const code = `<script setup lang="ts">
// ${componentName}
</script>

<template>
${body}
</template>
${remStyle}`
  return { code, assets }
}
