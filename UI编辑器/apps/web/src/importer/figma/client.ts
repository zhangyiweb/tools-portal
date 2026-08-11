import type { EditorDocument } from '../../schema/types'
import { mapFigmaToDocument, parseFigmaFileKey, type FigmaFileResponse } from './mapper'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function importFigmaFile(url: string, token: string): Promise<EditorDocument> {
  const fileKey = parseFigmaFileKey(url)
  const res = await fetch(`${API_BASE}/api/figma/file/${fileKey}`, {
    headers: {
      'X-Figma-Token': token,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Figma 导入失败 (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    file: FigmaFileResponse
    images: Record<string, string>
  }

  return mapFigmaToDocument(data.file, data.images ?? {})
}
