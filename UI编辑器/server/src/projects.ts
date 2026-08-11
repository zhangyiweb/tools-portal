import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { createDefaultDocumentPayload } from './defaultDoc'

export interface ProjectAsset {
  id: string
  name: string
  filename: string
  url: string
  mime: string
  size: number
  createdAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectRecord extends ProjectSummary {
  activePageId: string
  pages: unknown[]
  assets: ProjectAsset[]
}

const DATA_DIR = path.join(__dirname, '..', 'data')
const PROJECTS_DIR = path.join(DATA_DIR, 'projects')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')

async function ensureDirs() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true })
  try {
    await fs.access(INDEX_FILE)
  } catch {
    await fs.writeFile(INDEX_FILE, '[]', 'utf8')
  }
}

function projectFile(id: string) {
  return path.join(PROJECTS_DIR, `${id}.json`)
}

function assetsDir(projectId: string) {
  return path.join(PROJECTS_DIR, projectId, 'assets')
}

async function readIndex(): Promise<ProjectSummary[]> {
  await ensureDirs()
  const raw = await fs.readFile(INDEX_FILE, 'utf8')
  return JSON.parse(raw) as ProjectSummary[]
}

async function writeIndex(list: ProjectSummary[]) {
  await ensureDirs()
  await fs.writeFile(INDEX_FILE, JSON.stringify(list, null, 2), 'utf8')
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const list = await readIndex()
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  await ensureDirs()
  try {
    const raw = await fs.readFile(projectFile(id), 'utf8')
    return JSON.parse(raw) as ProjectRecord
  } catch {
    return null
  }
}

export async function createProject(name?: string): Promise<ProjectRecord> {
  await ensureDirs()
  const now = new Date().toISOString()
  const page = createDefaultDocumentPayload('页面 1')
  const project: ProjectRecord = {
    id: randomUUID(),
    name: (name?.trim() || '未命名项目'),
    createdAt: now,
    updatedAt: now,
    activePageId: (page as { meta: { id: string } }).meta.id,
    pages: [page],
    assets: [],
  }
  await fs.mkdir(assetsDir(project.id), { recursive: true })
  await fs.writeFile(projectFile(project.id), JSON.stringify(project, null, 2), 'utf8')
  const index = await readIndex()
  index.push({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  })
  await writeIndex(index)
  return project
}

export async function saveProject(
  id: string,
  patch: {
    name?: string
    activePageId?: string
    pages?: unknown[]
  },
): Promise<ProjectRecord | null> {
  const current = await getProject(id)
  if (!current) return null
  const now = new Date().toISOString()
  const next: ProjectRecord = {
    ...current,
    name: patch.name?.trim() || current.name,
    activePageId: patch.activePageId ?? current.activePageId,
    pages: patch.pages ?? current.pages,
    updatedAt: now,
  }
  await fs.writeFile(projectFile(id), JSON.stringify(next, null, 2), 'utf8')
  const index = await readIndex()
  const i = index.findIndex((p) => p.id === id)
  if (i >= 0) {
    index[i] = {
      id: next.id,
      name: next.name,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    }
    await writeIndex(index)
  }
  return next
}

export async function deleteProject(id: string): Promise<boolean> {
  const current = await getProject(id)
  if (!current) return false
  try {
    await fs.rm(path.join(PROJECTS_DIR, id), { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  try {
    await fs.unlink(projectFile(id))
  } catch {
    /* ignore */
  }
  const index = (await readIndex()).filter((p) => p.id !== id)
  await writeIndex(index)
  return true
}

export async function addAssets(
  projectId: string,
  files: Express.Multer.File[],
): Promise<ProjectAsset[] | null> {
  const project = await getProject(projectId)
  if (!project) return null
  await fs.mkdir(assetsDir(projectId), { recursive: true })
  const added: ProjectAsset[] = []
  for (const file of files) {
    const id = randomUUID()
    const ext = path.extname(file.originalname) || mimeToExt(file.mimetype)
    const filename = `${id}${ext}`
    const dest = path.join(assetsDir(projectId), filename)
    await fs.writeFile(dest, file.buffer)
    const asset: ProjectAsset = {
      id,
      name: file.originalname,
      filename,
      url: `/api/files/${projectId}/${filename}`,
      mime: file.mimetype || 'application/octet-stream',
      size: file.size,
      createdAt: new Date().toISOString(),
    }
    added.push(asset)
  }
  project.assets = [...added, ...project.assets]
  project.updatedAt = new Date().toISOString()
  await fs.writeFile(projectFile(projectId), JSON.stringify(project, null, 2), 'utf8')
  const index = await readIndex()
  const i = index.findIndex((p) => p.id === projectId)
  if (i >= 0) {
    index[i].updatedAt = project.updatedAt
    await writeIndex(index)
  }
  return added
}

export async function deleteAsset(projectId: string, assetId: string): Promise<boolean> {
  const project = await getProject(projectId)
  if (!project) return false
  const asset = project.assets.find((a) => a.id === assetId)
  if (!asset) return false
  try {
    await fs.unlink(path.join(assetsDir(projectId), asset.filename))
  } catch {
    /* ignore */
  }
  project.assets = project.assets.filter((a) => a.id !== assetId)
  project.updatedAt = new Date().toISOString()
  await fs.writeFile(projectFile(projectId), JSON.stringify(project, null, 2), 'utf8')
  return true
}

export function getAssetPath(projectId: string, filename: string) {
  const safe = path.basename(filename)
  return path.join(assetsDir(projectId), safe)
}

function mimeToExt(mime: string) {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }
  return map[mime] ?? '.bin'
}
