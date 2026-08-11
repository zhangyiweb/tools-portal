import type { EditorDocument } from '../schema/types'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectAsset {
  id: string
  name: string
  filename: string
  url: string
  mime: string
  size: number
  createdAt: string
}

export interface ProjectDetail extends ProjectSummary {
  activePageId: string
  pages: EditorDocument[]
  assets: ProjectAsset[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    let message = `请求失败 (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export function listProjects() {
  return request<ProjectSummary[]>('/api/projects')
}

export function createProject(name?: string) {
  return request<ProjectDetail>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function getProject(id: string) {
  return request<ProjectDetail>(`/api/projects/${id}`)
}

export function saveProject(
  id: string,
  body: { name: string; activePageId: string; pages: EditorDocument[] },
) {
  return request<ProjectDetail>(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteProject(id: string) {
  return request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' })
}

export async function uploadProjectAssets(projectId: string, files: FileList | File[]) {
  const form = new FormData()
  Array.from(files).forEach((file) => form.append('files', file))
  return request<{ added: ProjectAsset[]; assets: ProjectAsset[] }>(
    `/api/projects/${projectId}/assets`,
    { method: 'POST', body: form },
  )
}

export function deleteProjectAsset(projectId: string, assetId: string) {
  return request<{ ok: boolean }>(`/api/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  })
}
