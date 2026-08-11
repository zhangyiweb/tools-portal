import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Modal, message } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  createProject,
  deleteProject,
  listProjects,
  type ProjectSummary,
} from '../api/projects'
import './ProjectListPage.css'

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ProjectListPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      setProjects(await listProjects())
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败，请确认后端已启动')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const onCreate = async () => {
    setCreating(true)
    try {
      const project = await createProject(draftName || undefined)
      navigate(`/project/${project.id}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
      setCreating(false)
    }
  }

  const onDelete = (id: string, name: string) => {
    Modal.confirm({
      title: '删除项目',
      content: `确定删除「${name}」？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteProject(id)
          setProjects((prev) => prev.filter((p) => p.id !== id))
          message.success('已删除')
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败')
          throw e
        }
      },
    })
  }

  return (
    <div className="project-list-page">
      <header className="project-list-header">
        <div>
          <h1>UI 编辑器</h1>
          <p>选择项目进入编辑，或新建空白项目</p>
        </div>
        <div className="project-list-create">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="项目名称（可选）"
            allowClear
            onPressEnter={() => void onCreate()}
            style={{ width: 220 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={creating}
            onClick={() => void onCreate()}
          >
            新建项目
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="project-list-empty">加载中…</p>
      ) : projects.length === 0 ? (
        <p className="project-list-empty">还没有项目，点击右上角新建一个吧</p>
      ) : (
        <ul className="project-list-grid">
          {projects.map((p) => (
            <li key={p.id} className="project-card">
              <Link to={`/project/${p.id}`} className="project-card__main">
                <strong>{p.name}</strong>
                <span>更新于 {formatTime(p.updatedAt)}</span>
              </Link>
              <Button
                type="text"
                danger
                className="project-card__delete"
                icon={<DeleteOutlined />}
                title="删除"
                onClick={() => onDelete(p.id, p.name)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
