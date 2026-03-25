import { useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import SessionList from '../components/sessions/SessionList'
import SessionFilters from '../components/sessions/SessionFilters'

export default function SessionListPage() {
  const { fetchSessions, loading } = useSessionStore()

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 p-4">
        <h2 className="text-xl font-semibold">Sessions</h2>
        <p className="text-sm text-zinc-500 mt-1">
          All AI agent sessions across Claude Code, Cursor, and Codex
        </p>
      </div>
      <SessionFilters />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-zinc-500">
            Loading sessions...
          </div>
        ) : (
          <SessionList />
        )}
      </div>
    </div>
  )
}
