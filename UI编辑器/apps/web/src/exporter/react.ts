import type { CssUnit, StyleProps, UINode } from '../schema/types'
import { convertPxInCssValue, formatLength, resolveExportUnit } from '../schema/units'
import type { ExportOptions } from './html'
import { materializeImageAssets, type ExportAsset } from './assets'

function lengthValue(px: number, unit: CssUnit): string | number {
  return unit === 'rem' ? formatLength(px, 'rem') : px
}

function styleObjectLiteral(
  style: StyleProps,
  layout: Record<string, string | number>,
  unit: CssUnit,
): string {
  const entries: [string, string | number][] = []
  Object.entries(layout).forEach(([k, v]) => entries.push([k, v]))
  if (style.backgroundImage) {
    const url = /^url\(/i.test(style.backgroundImage)
      ? style.backgroundImage
      : `url(${JSON.stringify(style.backgroundImage)})`
    entries.push(['backgroundImage', url])
    entries.push(['backgroundSize', style.backgroundSize ?? 'cover'])
    entries.push(['backgroundPosition', style.backgroundPosition ?? 'center'])
    entries.push(['backgroundRepeat', style.backgroundRepeat ?? 'no-repeat'])
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
      entries.push(['backgroundColor', style.backgroundColor])
    }
  } else if (style.background) {
    entries.push(['background', style.background])
  } else if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    entries.push(['backgroundColor', style.backgroundColor])
  }
  if (style.color) entries.push(['color', style.color])
  if (style.fontSize != null) entries.push(['fontSize', lengthValue(style.fontSize, unit)])
  if (style.fontWeight != null) entries.push(['fontWeight', style.fontWeight])
  if (style.fontFamily) entries.push(['fontFamily', style.fontFamily])
  if (style.lineHeight != null) {
    entries.push([
      'lineHeight',
      typeof style.lineHeight === 'number' ? lengthValue(style.lineHeight, unit) : style.lineHeight,
    ])
  }
  if (style.letterSpacing != null) {
    entries.push(['letterSpacing', lengthValue(style.letterSpacing, unit)])
  }
  if (style.textAlign) entries.push(['textAlign', style.textAlign])
  if (style.borderRadius != null) entries.push(['borderRadius', lengthValue(style.borderRadius, unit)])
  if (style.borderWidth != null) {
    entries.push(['borderWidth', lengthValue(style.borderWidth, unit)])
    entries.push(['borderStyle', style.borderStyle ?? 'solid'])
    entries.push(['borderColor', style.borderColor ?? '#000'])
  }
  if (style.opacity != null) entries.push(['opacity', style.opacity])
  if (style.boxShadow) entries.push(['boxShadow', convertPxInCssValue(style.boxShadow, unit)])
  if (style.padding != null) entries.push(['padding', lengthValue(style.padding, unit)])
  if (style.margin != null) entries.push(['margin', lengthValue(style.margin, unit)])
  if (style.overflow) entries.push(['overflow', style.overflow])
  if (style.objectFit) entries.push(['objectFit', style.objectFit])
  if (style.objectPosition) entries.push(['objectPosition', style.objectPosition])
  if (style.zIndex != null) entries.push(['zIndex', style.zIndex])

  const body = entries
    .map(([k, v]) => `    ${k}: ${typeof v === 'string' ? JSON.stringify(v) : v},`)
    .join('\n')
  return `{\n${body}\n  }`
}

function escapeJsx(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

function renderNodeTsx(node: UINode, isRoot: boolean, indent: number, unit: CssUnit): string {
  const pad = '  '.repeat(indent)
  const layout: Record<string, string | number> = isRoot
    ? {
        position: 'relative',
        width: unit === 'rem' ? '100%' : lengthValue(node.width, unit),
        height: lengthValue(node.height, unit),
        boxSizing: 'border-box',
        ...(unit === 'rem' ? { maxWidth: '100vw', overflow: 'hidden' } : {}),
      }
    : {
        position: 'absolute',
        left: lengthValue(node.x, unit),
        top: lengthValue(node.y, unit),
        width: lengthValue(node.width, unit),
        height: lengthValue(node.height, unit),
        boxSizing: 'border-box',
      }

  const styleLit = styleObjectLiteral(node.style, layout, unit)
  const children =
    node.children?.map((c) => renderNodeTsx(c, false, indent + 1, unit)).join('\n') ?? ''
  const p = node.props ?? {}
  const isLib = node.type.startsWith('antd-') || node.type.startsWith('el-')
  const key = node.type.replace(/^(antd|el)-/, '')

  if (node.type === 'text') {
    return `${pad}<div style={${styleLit}}>\n${pad}  <div style={{ width: '100%', height: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden' }}>${escapeJsx(p.text ?? '')}</div>\n${children ? `${children}\n` : ''}${pad}</div>`
  }

  if (node.type === 'rect' || node.type === 'frame') {
    return `${pad}<div style={${styleLit}}>\n${children}\n${pad}</div>`
  }

  if (node.type === 'button' || key === 'button' || key === 'upload') {
    return `${pad}<button type="button" style={${styleLit}}>${escapeJsx(p.text ?? '按钮')}</button>`
  }

  if (node.type === 'input' || key === 'input' || key === 'date-picker' || key === 'time-picker') {
    return `${pad}<input placeholder={${JSON.stringify(p.placeholder ?? '')}} style={${styleLit}} />`
  }

  if (key === 'textarea') {
    return `${pad}<textarea placeholder={${JSON.stringify(p.placeholder ?? '')}} style={${styleLit}} />`
  }

  if (node.type === 'image') {
    return `${pad}<div style={${styleLit}}>\n${pad}  <img src={${JSON.stringify(p.src || '')}} alt={${JSON.stringify(p.alt ?? '')}} style={{ width: '100%', height: '100%', objectFit: ${JSON.stringify(node.style.objectFit ?? 'cover')}, display: 'block' }} />\n${pad}</div>`
  }

  if (key === 'select' || key === 'cascader') {
    return `${pad}<select style={${styleLit}}><option disabled>{${JSON.stringify(p.placeholder ?? '请选择')}}</option></select>`
  }

  if (key === 'tag' || key === 'link' || key === 'text') {
    return `${pad}<span style={${styleLit}}>${escapeJsx(p.text ?? node.name)}</span>`
  }

  if (key === 'checkbox' || key === 'radio' || key === 'switch') {
    const inputType = key === 'radio' ? 'radio' : 'checkbox'
    return `${pad}<label style={${styleLit}}><input type="${inputType}" defaultChecked={${!!p.checked}} /> ${escapeJsx(p.text ?? '')}</label>`
  }

  if (key === 'card') {
    return `${pad}<div style={${styleLit}}>\n${pad}  <div style={{ fontWeight: 600, marginBottom: 8 }}>${escapeJsx(p.title ?? '')}</div>\n${pad}  <div>${escapeJsx(p.text ?? '')}</div>\n${children ? `${children}\n` : ''}${pad}</div>`
  }

  if (key === 'table') {
    return `${pad}<table style={${styleLit}}><thead><tr><th>姓名</th><th>年龄</th><th>地址</th></tr></thead><tbody><tr><td>张三</td><td>28</td><td>上海</td></tr></tbody></table>`
  }

  if (isLib) {
    return `${pad}<div style={${styleLit}}>${escapeJsx(p.text ?? p.title ?? p.placeholder ?? node.name)}</div>`
  }

  return `${pad}<div style={${styleLit}}>\n${children}\n${pad}</div>`
}

export function exportReact(
  root: UINode,
  componentName = 'ExportedPage',
  options: ExportOptions = {},
): { code: string; assets: ExportAsset[] } {
  const { root: tree, assets } = materializeImageAssets(root)
  const unit = resolveExportUnit(options.unit)
  const designWidth = options.designWidth ?? tree.width
  const body = renderNodeTsx(tree, true, 2, unit)
  const remSetup =
    unit === 'rem'
      ? `
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.fontSize
    const apply = () => {
      html.style.fontSize = \`\${window.innerWidth / (${designWidth} / 100)}px\`
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      html.style.fontSize = prev
    }
  }, [])
`
      : ''

  const importLine = unit === 'rem' ? `import { useEffect } from 'react'\n\n` : ''

  const code = `${importLine}export default function ${componentName}() {${remSetup}
  return (
${body}
  )
}
`
  return { code, assets }
}
