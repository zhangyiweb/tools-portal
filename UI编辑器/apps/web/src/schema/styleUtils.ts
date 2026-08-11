import type { CSSProperties } from 'react'
import type { CssUnit, StyleProps, UINode } from './types'
import { convertPxInCssValue, formatLength, resolveCssUnit } from './units'

export interface CssTextOptions {
  unit?: CssUnit
  remBase?: number
}

export function styleToCss(style: StyleProps): CSSProperties {
  const css: CSSProperties = {}
  if (style.backgroundImage) {
    css.backgroundImage = toCssUrl(style.backgroundImage)
    css.backgroundSize = style.backgroundSize ?? 'cover'
    css.backgroundPosition = style.backgroundPosition ?? 'center'
    css.backgroundRepeat = style.backgroundRepeat ?? 'no-repeat'
    if (style.backgroundColor) css.backgroundColor = style.backgroundColor
  } else if (style.background) {
    css.background = style.background
  } else if (style.backgroundColor) {
    css.backgroundColor = style.backgroundColor
  }
  if (style.color) css.color = style.color
  if (style.fontSize != null) css.fontSize = style.fontSize
  if (style.fontWeight != null) css.fontWeight = style.fontWeight
  if (style.fontFamily) css.fontFamily = style.fontFamily
  if (style.lineHeight != null) css.lineHeight = style.lineHeight
  if (style.letterSpacing != null) css.letterSpacing = style.letterSpacing
  if (style.textAlign) css.textAlign = style.textAlign
  if (style.borderRadius != null) css.borderRadius = style.borderRadius
  if (style.borderWidth != null) {
    css.borderWidth = style.borderWidth
    css.borderStyle = style.borderStyle ?? 'solid'
    css.borderColor = style.borderColor ?? '#000'
  } else if (style.borderStyle && style.borderStyle !== 'none') {
    css.borderStyle = style.borderStyle
    if (style.borderColor) css.borderColor = style.borderColor
  }
  if (style.opacity != null) css.opacity = style.opacity
  if (style.boxShadow) css.boxShadow = style.boxShadow
  if (style.padding != null) css.padding = style.padding
  if (style.margin != null) css.margin = style.margin
  if (style.overflow) css.overflow = style.overflow as CSSProperties['overflow']
  if (style.objectFit) css.objectFit = style.objectFit
  if (style.objectPosition) css.objectPosition = style.objectPosition
  if (style.zIndex != null) css.zIndex = style.zIndex
  return css
}

function toCssUrl(src: string): string {
  if (/^url\(/i.test(src)) return src
  const escaped = src.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `url("${escaped}")`
}

export function nodeBoxStyle(node: UINode, isRoot = false): CSSProperties {
  return {
    position: isRoot ? 'relative' : 'absolute',
    left: isRoot ? undefined : node.x,
    top: isRoot ? undefined : node.y,
    width: node.width,
    height: node.height,
    boxSizing: 'border-box',
    ...styleToCss(node.style),
    display: node.visible === false ? 'none' : undefined,
  }
}

export function stylePropsToCssText(
  style: StyleProps,
  extra: Record<string, string | number> = {},
  options: CssTextOptions = {},
): string {
  const unit = resolveCssUnit(options.unit)
  const remBase = options.remBase
  const len = (n: number) => formatLength(n, unit, remBase)

  const map: Record<string, string | number | undefined> = {
    background: style.backgroundImage ? undefined : style.background,
    'background-color': style.backgroundImage
      ? style.backgroundColor
      : style.background
        ? undefined
        : style.backgroundColor,
    'background-image': style.backgroundImage ? toCssUrl(style.backgroundImage) : undefined,
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
    'border-style':
      style.borderWidth != null || style.borderStyle
        ? (style.borderStyle ?? 'solid')
        : undefined,
    'border-color':
      style.borderWidth != null || style.borderColor
        ? (style.borderColor ?? '#000')
        : undefined,
    opacity: style.opacity,
    'box-shadow': style.boxShadow
      ? convertPxInCssValue(style.boxShadow, unit, remBase)
      : undefined,
    padding: style.padding != null ? len(style.padding) : undefined,
    margin: style.margin != null ? len(style.margin) : undefined,
    overflow: style.overflow,
    'object-fit': style.objectFit,
    'object-position': style.objectPosition,
    'z-index': style.zIndex,
    ...extra,
  }

  return Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
}
