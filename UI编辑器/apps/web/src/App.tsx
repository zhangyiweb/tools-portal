import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProjectListPage } from './pages/ProjectListPage'
import { EditorPage } from './pages/EditorPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/project/:projectId" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
