import type { UINode } from '../schema/types'

export interface ExportAsset {
  /** zip 内相对路径，如 assets/img-0.png */
  path: string
  mime: string
  data: Uint8Array
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

function extFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? 'bin'
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 解析 data URL；非 data URL 返回 null */
export function parseDataUrl(src: string): { mime: string; data: Uint8Array } | null {
  if (!src.startsWith('data:')) return null
  const m = src.match(/^data:([^;,]+)?((?:;[^,]*)*),([\s\S]*)$/i)
  if (!m) return null
  const mime = (m[1] || 'application/octet-stream').trim()
  const params = m[2] || ''
  const payload = m[3]
  if (/;base64/i.test(params)) {
    return { mime, data: base64ToUint8Array(payload.replace(/\s/g, '')) }
  }
  try {
    return { mime, data: new TextEncoder().encode(decodeURIComponent(payload)) }
  } catch {
    return { mime, data: new TextEncoder().encode(payload) }
  }
}

/**
 * 将节点树中的 data URL 图片抽出为静态资源，并把 src 改成相对路径。
 * 相同内容只写一份文件。
 */
export function materializeImageAssets(
  root: UINode,
  folder = 'assets',
): { root: UINode; assets: ExportAsset[] } {
  const assets: ExportAsset[] = []
  const seen = new Map<string, string>()

  const resolveSrc = (src: string | undefined): string => {
    if (!src) return ''
    const parsed = parseDataUrl(src)
    if (!parsed) return src

    const cached = seen.get(src)
    if (cached) return cached

    const path = `${folder}/img-${assets.length}.${extFromMime(parsed.mime)}`
    const href = `./${path}`
    assets.push({ path, mime: parsed.mime, data: parsed.data })
    seen.set(src, href)
    return href
  }

  const walk = (node: UINode): UINode => {
    let next = node
    if (node.type === 'image' && node.props?.src) {
      const rewritten = resolveSrc(node.props.src)
      if (rewritten !== node.props.src) {
        next = { ...node, props: { ...node.props, src: rewritten } }
      }
    }
    if (next.style.backgroundImage) {
      const rewritten = resolveSrc(next.style.backgroundImage)
      if (rewritten !== next.style.backgroundImage) {
        next = {
          ...next,
          style: { ...next.style, backgroundImage: rewritten },
        }
      }
    }
    if (next.children?.length) {
      const children = next.children.map(walk)
      if (children.some((c, i) => c !== next.children![i])) {
        next = { ...next, children }
      }
    }
    return next
  }

  return { root: walk(root), assets }
}
