import { useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import SessionList from '../components/sessions/SessionList'
import SessionFilters from '../components/sessions/SessionFilters'

export default function SessionListPage() {
  const { fetchSessions, loading, fetchError, sessions } = useSessionStore()

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const showFullPageSpinner = loading && sessions.length === 0

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
        {fetchError && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
            <p className="font-medium">Could not load sessions</p>
            <p className="mt-1 text-xs text-amber-200/70">{fetchError}</p>
            <button
              type="button"
              onClick={() => fetchSessions()}
              className="mt-3 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/30"
            >
              Retry
            </button>
          </div>
        )}
        {loading && sessions.length > 0 && (
          <p className="mb-3 text-center text-xs text-zinc-500">Refreshing session list…</p>
        )}
        {showFullPageSpinner ? (
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
