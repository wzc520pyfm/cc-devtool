import { useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import SessionListPage from './pages/SessionListPage'
import SessionDetailPage from './pages/SessionDetailPage'
import { useWebSocket } from './hooks/useWebSocket'
import { useSessionStore } from './stores/sessionStore'

export default function App() {
  const fetchSessions = useSessionStore((s) => s.fetchSessions)

  const handleMessage = useCallback((msg: { type: string }) => {
    if (msg.type === 'session_update') {
      fetchSessions()
    }
  }, [fetchSessions])

  useWebSocket(handleMessage)

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:tool/:id" element={<SessionDetailPage />} />
      </Route>
    </Routes>
  )
}
