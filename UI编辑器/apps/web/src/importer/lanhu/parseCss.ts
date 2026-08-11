import type { StyleProps, UINode } from '../../schema/types'

export interface ParsedLanhuCss {
  style: Partial<StyleProps>
  layout: Partial<Pick<UINode, 'width' | 'height' | 'x' | 'y'>>
  props: Partial<NonNullable<UINode['props']>>
  applied: string[]
  ignored: string[]
}

/** 解析蓝湖复制的 CSS / 样式文本，映射到编辑器样式与尺寸 */
export function parseLanhuCss(raw: string): ParsedLanhuCss {
  const result: ParsedLanhuCss = {
    style: {},
    layout: {},
    props: {},
    applied: [],
    ignored: [],
  }

  const decls = extractDeclarations(raw)
  for (const [prop, value] of decls) {
    const key = normalizeProp(prop)
    const val = value.trim().replace(/;+\s*$/, '')
    if (!key || !val) continue
    applyDeclaration(key, val, result)
  }

  return result
}

function extractDeclarations(raw: string): Array<[string, string]> {
  let text = raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .trim()

  // 去掉选择器包裹：.foo { ... } 或 #id { ... }
  const blockMatch = text.match(/\{([\s\S]*)\}/)
  if (blockMatch) text = blockMatch[1]

  // 兼容蓝湖中文标注：宽度：100px
  text = text
    .replace(/宽度\s*[：:]\s*/g, 'width: ')
    .replace(/高度\s*[：:]\s*/g, 'height: ')
    .replace(/圆角\s*[：:]\s*/g, 'border-radius: ')
    .replace(/字号\s*[：:]\s*/g, 'font-size: ')
    .replace(/字体\s*[：:]\s*/g, 'font-family: ')
    .replace(/字重\s*[：:]\s*/g, 'font-weight: ')
    .replace(/行高\s*[：:]\s*/g, 'line-height: ')
    .replace(/颜色\s*[：:]\s*/g, 'color: ')
    .replace(/背景色?\s*[：:]\s*/g, 'background: ')
    .replace(/透明度\s*[：:]\s*/g, 'opacity: ')
    .replace(/对齐\s*[：:]\s*/g, 'text-align: ')

  const decls: Array<[string, string]> = []
  // property: value;  （值里可能有括号、引号）
  const re = /([a-zA-Z_-][\w-]*)\s*:\s*([^;]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    decls.push([m[1], m[2].trim()])
  }
  return decls
}

function normalizeProp(prop: string): string {
  return prop.trim().toLowerCase()
}

function parsePx(value: string, remBase = 100): number | null {
  const m = value.trim().match(/^(-?[\d.]+)(px|rem|em)?$/i)
  if (!m) return null
  let n = Number(m[1])
  if (Number.isNaN(n)) return null
  const unit = (m[2] || 'px').toLowerCase()
  if (unit === 'rem' || unit === 'em') n *= remBase
  return Math.round(n * 100) / 100
}

function parseNumber(value: string): number | null {
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : null
}

function isColorLike(value: string): boolean {
  const v = value.trim()
  return (
    /^#([0-9a-f]{3,8})$/i.test(v) ||
    /^rgba?\(/i.test(v) ||
    /^hsla?\(/i.test(v) ||
    /^(transparent|currentcolor)$/i.test(v) ||
    /^[a-z]+$/i.test(v)
  )
}

function mark(result: ParsedLanhuCss, prop: string) {
  if (!result.applied.includes(prop)) result.applied.push(prop)
}

function ignore(result: ParsedLanhuCss, prop: string) {
  if (!result.ignored.includes(prop)) result.ignored.push(prop)
}

function applyDeclaration(prop: string, value: string, result: ParsedLanhuCss) {
  switch (prop) {
    case 'width': {
      const n = parsePx(value)
      if (n != null && n >= 0) {
        result.layout.width = Math.max(1, Math.round(n))
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'height': {
      const n = parsePx(value)
      if (n != null && n >= 0) {
        result.layout.height = Math.max(1, Math.round(n))
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'left':
    case 'margin-left': {
      const n = parsePx(value)
      if (n != null) {
        result.layout.x = Math.round(n)
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'top':
    case 'margin-top': {
      const n = parsePx(value)
      if (n != null) {
        result.layout.y = Math.round(n)
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'background':
    case 'background-color': {
      if (/gradient\(/i.test(value) || /url\(/i.test(value)) {
        result.style.background = value
        mark(result, prop)
      } else if (isColorLike(value.split(/\s+/)[0])) {
        // background: #fff url(...) no-repeat — take first color token if solid
        const colorToken = value.match(/(#(?:[0-9a-f]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)/i)
        if (colorToken && !/^(none|scroll|fixed|local|left|right|center|top|bottom|cover|contain|repeat)/i.test(colorToken[1])) {
          result.style.backgroundColor = colorToken[1]
          mark(result, prop)
        } else if (prop === 'background-color') {
          result.style.backgroundColor = value
          mark(result, prop)
        } else {
          result.style.background = value
          mark(result, prop)
        }
      } else {
        result.style.background = value
        mark(result, prop)
      }
      break
    }
    case 'color': {
      result.style.color = value
      mark(result, prop)
      break
    }
    case 'font-size': {
      const n = parsePx(value)
      if (n != null) {
        result.style.fontSize = n
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'font-weight': {
      const n = parseNumber(value)
      result.style.fontWeight = n != null ? n : value
      mark(result, prop)
      break
    }
    case 'font-family': {
      result.style.fontFamily = value.replace(/^["']|["']$/g, '')
      mark(result, prop)
      break
    }
    case 'line-height': {
      const px = parsePx(value)
      if (px != null && /px|rem|em/i.test(value)) {
        result.style.lineHeight = `${px}px`
      } else {
        result.style.lineHeight = value
      }
      mark(result, prop)
      break
    }
    case 'text-align': {
      const align = value.toLowerCase()
      if (align === 'left' || align === 'center' || align === 'right') {
        result.style.textAlign = align
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'border-radius': {
      // 8px or 8px 8px 0 0 — take first
      const first = value.split(/\s+/)[0]
      const n = parsePx(first)
      if (n != null) {
        result.style.borderRadius = n
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'border': {
      // 1px solid #E5E5E5
      const widthMatch = value.match(/([\d.]+)px/i)
      const styleMatch = value.match(/\b(solid|dashed|dotted|none|double)\b/i)
      const colorMatch = value.match(/(#(?:[0-9a-f]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\))/i)
      if (widthMatch) result.style.borderWidth = Number(widthMatch[1])
      if (styleMatch) result.style.borderStyle = styleMatch[1].toLowerCase()
      if (colorMatch) result.style.borderColor = colorMatch[1]
      if (widthMatch || colorMatch) mark(result, prop)
      else ignore(result, prop)
      break
    }
    case 'border-width': {
      const n = parsePx(value.split(/\s+/)[0])
      if (n != null) {
        result.style.borderWidth = n
        result.style.borderStyle = result.style.borderStyle ?? 'solid'
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'border-color': {
      result.style.borderColor = value.split(/\s+/)[0]
      result.style.borderStyle = result.style.borderStyle ?? 'solid'
      if (result.style.borderWidth == null) result.style.borderWidth = 1
      mark(result, prop)
      break
    }
    case 'border-style': {
      result.style.borderStyle = value.split(/\s+/)[0]
      mark(result, prop)
      break
    }
    case 'opacity': {
      const n = parseNumber(value)
      if (n != null) {
        result.style.opacity = Math.min(1, Math.max(0, n))
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'box-shadow':
    case 'shadow': {
      if (value.toLowerCase() !== 'none') {
        result.style.boxShadow = value
        mark(result, prop)
      }
      break
    }
    case 'padding': {
      const first = value.split(/\s+/)[0]
      const n = parsePx(first)
      if (n != null) {
        result.style.padding = n
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'overflow': {
      result.style.overflow = value.split(/\s+/)[0]
      mark(result, prop)
      break
    }
    case 'object-fit': {
      const fit = value.toLowerCase()
      if (fit === 'cover' || fit === 'contain' || fit === 'fill') {
        result.style.objectFit = fit
        mark(result, prop)
      } else ignore(result, prop)
      break
    }
    case 'content': {
      // content: "文案";
      const text = value.replace(/^["']|["']$/g, '')
      if (text && text !== 'normal' && text !== 'none') {
        result.props.text = text
        mark(result, prop)
      }
      break
    }
    default:
      ignore(result, prop)
  }
}

export function applyParsedCssToNode(
  node: UINode,
  parsed: ParsedLanhuCss,
): Partial<UINode> {
  return {
    ...parsed.layout,
    style: {
      ...node.style,
      ...parsed.style,
    },
    props: {
      ...node.props,
      ...parsed.props,
    },
  }
}
