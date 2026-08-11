import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import multer from 'multer'
import path from 'path'
import {
  addAssets,
  createProject,
  deleteAsset,
  deleteProject,
  getAssetPath,
  getProject,
  listProjects,
  saveProject,
} from './projects'

const app = express()
const PORT = Number(process.env.PORT) || 8787
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
})

app.use(cors())
app.use(express.json({ limit: '32mb' }))

type FigmaNode = {
  id: string
  type: string
  name: string
  children?: FigmaNode[]
  fills?: Array<{ type: string; visible?: boolean }>
}

function collectImageNodeIds(node: FigmaNode, acc: string[] = []): string[] {
  const hasImageFill = node.fills?.some((f) => f.type === 'IMAGE' && f.visible !== false)
  if (hasImageFill || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    acc.push(node.id)
  }
  node.children?.forEach((c) => collectImageNodeIds(c, acc))
  return acc
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/projects', async (_req, res) => {
  try {
    res.json(await listProjects())
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '读取失败' })
  }
})

app.post('/api/projects', async (req, res) => {
  try {
    const project = await createProject(typeof req.body?.name === 'string' ? req.body.name : undefined)
    res.status(201).json(project)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '创建失败' })
  }
})

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id)
    if (!project) {
      res.status(404).json({ error: '项目不存在' })
      return
    }
    res.json(project)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '读取失败' })
  }
})

app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await saveProject(req.params.id, {
      name: req.body?.name,
      activePageId: req.body?.activePageId,
      pages: req.body?.pages,
    })
    if (!project) {
      res.status(404).json({ error: '项目不存在' })
      return
    }
    res.json(project)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '保存失败' })
  }
})

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const ok = await deleteProject(req.params.id)
    if (!ok) {
      res.status(404).json({ error: '项目不存在' })
      return
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '删除失败' })
  }
})

app.post('/api/projects/:id/assets', upload.array('files', 50), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    if (!files.length) {
      res.status(400).json({ error: '未选择文件' })
      return
    }
    const added = await addAssets(req.params.id, files)
    if (!added) {
      res.status(404).json({ error: '项目不存在' })
      return
    }
    const project = await getProject(req.params.id)
    res.status(201).json({ added, assets: project?.assets ?? [] })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '上传失败' })
  }
})

app.delete('/api/projects/:id/assets/:assetId', async (req, res) => {
  try {
    const ok = await deleteAsset(req.params.id, req.params.assetId)
    if (!ok) {
      res.status(404).json({ error: '资源不存在' })
      return
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : '删除失败' })
  }
})

app.get('/api/files/:projectId/:filename', async (req, res) => {
  try {
    const filePath = getAssetPath(req.params.projectId, req.params.filename)
    res.sendFile(path.resolve(filePath), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: '文件不存在' })
    })
  } catch {
    res.status(404).json({ error: '文件不存在' })
  }
})

app.get('/api/figma/file/:fileKey', async (req, res) => {
  const token = req.header('X-Figma-Token') || req.query.token
  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: '缺少 X-Figma-Token' })
    return
  }

  const { fileKey } = req.params
  try {
    const fileRes = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 'X-Figma-Token': token },
    })
    const fileText = await fileRes.text()
    if (!fileRes.ok) {
      res.status(fileRes.status).send(fileText)
      return
    }

    const file = JSON.parse(fileText) as { name: string; document: FigmaNode }
    const ids = collectImageNodeIds(file.document).slice(0, 80)
    let images: Record<string, string> = {}

    if (ids.length) {
      const imgUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids.join(','))}&format=png&scale=2`
      const imgRes = await fetch(imgUrl, {
        headers: { 'X-Figma-Token': token },
      })
      if (imgRes.ok) {
        const imgJson = (await imgRes.json()) as { images?: Record<string, string | null> }
        images = Object.fromEntries(
          Object.entries(imgJson.images ?? {}).filter(([, v]) => !!v) as [string, string][],
        )
      }
    }

    res.json({ file, images })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : '代理请求失败',
    })
  }
})

app.listen(PORT, () => {
  console.log(`UI Editor API listening on http://localhost:${PORT}`)
})
