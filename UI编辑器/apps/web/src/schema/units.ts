import type { CssUnit, StyleProps, UINode } from './types'

/** 设计稿常用：100px = 1rem，便于换算 */
export const DEFAULT_REM_BASE = 100

export function resolveCssUnit(unit?: CssUnit): CssUnit {
  return unit === 'rem' ? 'rem' : 'px'
}

/** 导出默认使用 rem 自适应；仅显式传 px 时固定像素 */
export function resolveExportUnit(unit?: CssUnit): CssUnit {
  return unit === 'px' ? 'px' : 'rem'
}

export function pxToRem(px: number, remBase = DEFAULT_REM_BASE): number {
  const n = px / remBase
  return Math.round(n * 10000) / 10000
}

/** 将设计稿 px 转为导出用的长度字符串 */
export function formatLength(px: number, unit: CssUnit = 'px', remBase = DEFAULT_REM_BASE): string {
  if (unit === 'rem') return `${pxToRem(px, remBase)}rem`
  return `${px}px`
}

/** 把字符串里的 px 长度按同样比例转成 rem（如 box-shadow） */
export function convertPxInCssValue(value: string, unit: CssUnit, remBase = DEFAULT_REM_BASE): string {
  if (unit !== 'rem') return value
  return value.replace(/(-?[\d.]+)px\b/gi, (_, n: string) => {
    const num = Number(n)
    if (!Number.isFinite(num)) return `${n}px`
    return `${pxToRem(num, remBase)}rem`
  })
}

/**
 * rem 自适应根字号：设计宽度下 1rem = remBase px。
 * 视口变宽/变窄时，整页按比例缩放。
 */
export function remRootFontSizeCss(designWidth: number, remBase = DEFAULT_REM_BASE): string {
  const w = Math.max(1, designWidth)
  const divisor = w / remBase
  return `html { font-size: calc(100vw / ${divisor}); }`
}

export function scaleStyleLengths(style: StyleProps, scale: number): StyleProps {
  if (scale === 1) return style
  const next: StyleProps = { ...style }
  if (next.fontSize != null) next.fontSize = round(next.fontSize * scale)
  if (next.borderRadius != null) next.borderRadius = round(next.borderRadius * scale)
  if (next.borderWidth != null) next.borderWidth = round(next.borderWidth * scale)
  if (next.padding != null) next.padding = round(next.padding * scale)
  if (typeof next.lineHeight === 'number') next.lineHeight = round(next.lineHeight * scale)
  if (next.boxShadow) next.boxShadow = scalePxInCssValue(next.boxShadow, scale)
  return next
}

/** rem 模式下切换页面尺寸时，按宽度比例缩放整棵节点树 */
export function scaleNodeTree(node: UINode, scale: number, isRoot = false): UINode {
  if (scale === 1) return node
  return {
    ...node,
    x: isRoot ? node.x : round(node.x * scale),
    y: isRoot ? node.y : round(node.y * scale),
    width: isRoot ? node.width : Math.max(1, round(node.width * scale)),
    height: isRoot ? node.height : Math.max(1, round(node.height * scale)),
    style: scaleStyleLengths(node.style, scale),
    children: node.children?.map((c) => scaleNodeTree(c, scale, false)),
  }
}

function scalePxInCssValue(value: string, scale: number): string {
  return value.replace(/(-?[\d.]+)px\b/gi, (_, n: string) => {
    const num = Number(n)
    if (!Number.isFinite(num)) return `${n}px`
    return `${round(num * scale)}px`
  })
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
