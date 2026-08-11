import { v4 as uuid } from 'uuid'
import type { EditorDocument, NodeType, StyleProps, UINode } from '../../schema/types'

/** Minimal Figma API node shapes we care about */
export interface FigmaColor {
  r: number
  g: number
  b: number
  a: number
}

export interface FigmaNode {
  id: string
  name: string
  type: string
  visible?: boolean
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number }
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number }
  fills?: Array<{ type: string; visible?: boolean; color?: FigmaColor; opacity?: number }>
  strokes?: Array<{ type: string; visible?: boolean; color?: FigmaColor }>
  strokeWeight?: number
  cornerRadius?: number
  rectangleCornerRadii?: number[]
  opacity?: number
  characters?: string
  style?: {
    fontFamily?: string
    fontWeight?: number
    fontSize?: number
    textAlignHorizontal?: string
    lineHeightPx?: number
  }
  children?: FigmaNode[]
  clipsContent?: boolean
}

export interface FigmaFileResponse {
  name: string
  document: FigmaNode
}

function rgba(c: FigmaColor, opacity = 1): string {
  const a = (c.a ?? 1) * opacity
  const r = Math.round(c.r * 255)
  const g = Math.round(c.g * 255)
  const b = Math.round(c.b * 255)
  if (a >= 0.999) {
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  }
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
}

function solidFill(node: FigmaNode): string | undefined {
  const fill = node.fills?.find((f) => f.type === 'SOLID' && f.visible !== false && f.color)
  if (!fill?.color) return undefined
  return rgba(fill.color, fill.opacity ?? 1)
}

function strokeColor(node: FigmaNode): string | undefined {
  const stroke = node.strokes?.find((s) => s.visible !== false && s.color)
  if (!stroke?.color) return undefined
  return rgba(stroke.color)
}

function mapType(figmaType: string): NodeType {
  switch (figmaType) {
    case 'TEXT':
      return 'text'
    case 'RECTANGLE':
    case 'ELLIPSE':
    case 'POLYGON':
    case 'STAR':
    case 'LINE':
    case 'VECTOR':
      return 'rect'
    case 'FRAME':
    case 'GROUP':
    case 'COMPONENT':
    case 'INSTANCE':
    case 'SECTION':
    case 'COMPONENT_SET':
      return 'frame'
    default:
      return 'frame'
  }
}

function pickArtboard(document: FigmaNode): FigmaNode {
  const page = document.children?.[0]
  if (!page) return document
  const frames = (page.children ?? []).filter((c) =>
    ['FRAME', 'COMPONENT', 'INSTANCE', 'SECTION'].includes(c.type),
  )
  if (frames.length) {
    // Prefer largest frame
    return frames.reduce((a, b) => {
      const aw = (a.absoluteBoundingBox?.width ?? 0) * (a.absoluteBoundingBox?.height ?? 0)
      const bw = (b.absoluteBoundingBox?.width ?? 0) * (b.absoluteBoundingBox?.height ?? 0)
      return bw > aw ? b : a
    })
  }
  return page
}

function convertNode(
  node: FigmaNode,
  parentAbs: { x: number; y: number },
  imageUrls: Record<string, string>,
): UINode | null {
  if (node.visible === false) return null
  const box = node.absoluteBoundingBox
  if (!box && !node.children?.length) return null

  const type = mapType(node.type)
  const abs = box ?? { x: parentAbs.x, y: parentAbs.y, width: 0, height: 0 }
  const x = Math.round(abs.x - parentAbs.x)
  const y = Math.round(abs.y - parentAbs.y)
  const width = Math.max(1, Math.round(abs.width || 1))
  const height = Math.max(1, Math.round(abs.height || 1))

  const style: StyleProps = {
    opacity: node.opacity,
    borderRadius: node.cornerRadius ?? node.rectangleCornerRadii?.[0],
  }

  const bg = solidFill(node)
  if (bg) style.backgroundColor = bg

  if (node.strokeWeight && strokeColor(node)) {
    style.borderWidth = node.strokeWeight
    style.borderColor = strokeColor(node)
    style.borderStyle = 'solid'
  }

  if (node.clipsContent) style.overflow = 'hidden'

  const props: UINode['props'] = {}

  if (node.type === 'TEXT') {
    style.color = bg ? undefined : solidFill({ ...node, fills: node.fills }) ?? '#111111'
    // text fill is in fills
    const textFill = solidFill(node)
    if (textFill) style.color = textFill
    delete style.backgroundColor
    if (node.style) {
      style.fontSize = node.style.fontSize
      style.fontWeight = node.style.fontWeight
      style.fontFamily = node.style.fontFamily
      if (node.style.lineHeightPx) style.lineHeight = `${node.style.lineHeightPx}px`
      const align = node.style.textAlignHorizontal?.toLowerCase()
      if (align === 'center' || align === 'right' || align === 'left') {
        style.textAlign = align
      }
    }
    props.text = node.characters ?? ''
  }

  const imageUrl = imageUrls[node.id]
  let finalType: NodeType = type
  if (imageUrl) {
    finalType = 'image'
    props.src = imageUrl
    props.alt = node.name
    style.objectFit = 'cover'
  }

  const children: UINode[] = []
  if (node.children?.length && finalType !== 'image') {
    for (const child of node.children) {
      const mapped = convertNode(child, { x: abs.x, y: abs.y }, imageUrls)
      if (mapped) children.push(mapped)
    }
  }

  if (children.length > 0) {
    finalType = 'frame'
  }

  return {
    id: uuid(),
    type: finalType,
    name: node.name || finalType,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width,
    height,
    style,
    props,
    children: finalType === 'frame' ? children : undefined,
    visible: true,
  }
}

export function mapFigmaToDocument(
  file: FigmaFileResponse,
  imageUrls: Record<string, string> = {},
): EditorDocument {
  const artboard = pickArtboard(file.document)
  const abs = artboard.absoluteBoundingBox ?? { x: 0, y: 0, width: 375, height: 812 }
  const root = convertNode(artboard, { x: abs.x, y: abs.y }, imageUrls)

  const fallback: UINode = {
    id: uuid(),
    type: 'frame',
    name: artboard.name || file.name || '导入页面',
    x: 0,
    y: 0,
    width: Math.round(abs.width) || 375,
    height: Math.round(abs.height) || 812,
    style: { backgroundColor: '#ffffff', overflow: 'hidden' },
    children: [],
  }

  const resolved = root ?? fallback
  // Root should be at 0,0
  resolved.x = 0
  resolved.y = 0
  if (resolved.type !== 'frame') {
    // wrap
    const wrapped: UINode = {
      ...fallback,
      width: resolved.width,
      height: resolved.height,
      children: [{ ...resolved, x: 0, y: 0 }],
    }
    return {
      meta: {
        id: uuid(),
        name: file.name || 'Figma 导入',
        width: wrapped.width,
        height: wrapped.height,
        backgroundColor: '#f3f4f6',
      },
      root: wrapped,
    }
  }

  return {
    meta: {
      id: uuid(),
      name: file.name || 'Figma 导入',
      width: resolved.width,
      height: resolved.height,
      backgroundColor: '#f3f4f6',
    },
    root: resolved,
  }
}

export function parseFigmaFileKey(url: string): string {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
  if (!match) throw new Error('无法从 URL 解析 Figma 文件 Key，请检查链接格式')
  return match[1]
}
