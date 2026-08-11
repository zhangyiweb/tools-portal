import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Modal } from 'antd'
import { Toolbar } from '../components/Toolbar'
import { LeftPanel } from '../components/LeftPanel'
import { RightPanel } from '../components/RightPanel'
import { PageBar } from '../components/PageBar'
import { Canvas } from '../canvas/Canvas'
import { getProject, saveProject } from '../api/projects'
import { clearLegacyStorage, useEditorStore } from '../store/editorStore'
import '../styles/app.css'

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const loadProject = useEditorStore((s) => s.loadProject)
  const markSaved = useEditorStore((s) => s.markSaved)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)

  useEffect(() => {
    clearLegacyStorage()
  }, [])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    setError('')
    void getProject(projectId)
      .then((project) => {
        if (cancelled) return
        loadProject({
          id: project.id,
          name: project.name,
          pages: project.pages,
          activePageId: project.activePageId,
          assets: project.assets ?? [],
        })
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '加载项目失败')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, loadProject])

  const handleSave = useCallback(async () => {
    const state = useEditorStore.getState()
    if (!state.projectId) return false
    setSaving(true)
    setSaveMessage('')
    try {
      const pages = state.pages.map((p) =>
        p.meta.id === state.activePageId ? state.doc : p,
      )
      await saveProject(state.projectId, {
        name: state.projectName,
        activePageId: state.activePageId,
        pages,
      })
      markSaved()
      setSaveMessage('已保存')
      setTimeout(() => setSaveMessage(''), 1500)
      return true
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }, [markSaved])

  const leaveToList = useCallback(() => {
    navigate('/')
  }, [navigate])

  const requestLeave = useCallback(() => {
    if (!useEditorStore.getState().dirty) {
      leaveToList()
      return
    }
    setLeaveOpen(true)
  }, [leaveToList])

  const confirmLeaveWithoutSave = () => {
    setLeaveOpen(false)
    leaveToList()
  }

  const confirmLeaveWithSave = async () => {
    const ok = await handleSave()
    if (!ok) return
    setLeaveOpen(false)
    leaveToList()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!useEditorStore.getState().dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  if (loading) {
    return (
      <div className="app-shell app-shell--center">
        <p className="editor-status">正在加载项目…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell app-shell--center">
        <p className="editor-status editor-status--error">{error}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          返回列表
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Toolbar
        onSave={() => void handleSave()}
        onBack={requestLeave}
        saving={saving}
        saveMessage={saveMessage}
      />
      <div className="app-body">
        <LeftPanel />
        <div className="canvas-column">
          <Canvas />
          <PageBar />
        </div>
        <RightPanel />
      </div>

      {leaveOpen ? (
        <Modal
          open={leaveOpen}
          title="尚未保存"
          centered
          onCancel={() => setLeaveOpen(false)}
          footer={[
            <Button key="cancel" onClick={() => setLeaveOpen(false)}>
              取消
            </Button>,
            <Button key="discard" onClick={confirmLeaveWithoutSave}>
              不保存
            </Button>,
            <Button
              key="save"
              type="primary"
              loading={saving}
              onClick={() => void confirmLeaveWithSave()}
            >
              保存并离开
            </Button>,
          ]}
        >
          <p style={{ margin: 0 }}>当前项目有未保存的修改，离开前要保存吗？</p>
        </Modal>
      ) : null}
    </div>
  )
}
