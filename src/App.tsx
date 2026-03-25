import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import SessionListPage from './pages/SessionListPage'
import SessionDetailPage from './pages/SessionDetailPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:tool/:id" element={<SessionDetailPage />} />
      </Route>
    </Routes>
  )
}
