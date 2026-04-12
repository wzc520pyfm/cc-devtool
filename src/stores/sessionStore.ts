import { create } from 'zustand'
import type { SessionSummary, Session, ToolSource } from '@shared/types'
import { api } from '../lib/api'

interface Filters {
  tool: ToolSource | 'all'
  source: 'all' | 'local' | 'proxy'
  search: string
}

let sessionsFetchGen = 0
let sessionsAbort: AbortController | null = null

interface SessionStore {
  sessions: SessionSummary[]
  filters: Filters
  loading: boolean
  fetchError: string | null
  setFilters: (filters: Partial<Filters>) => void
  fetchSessions: () => Promise<void>
  fetchSessionDetail: (tool: string, id: string) => Promise<Session | null>
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  filters: { tool: 'all', source: 'all', search: '' },
  loading: false,
  fetchError: null,

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),

  fetchSessions: async () => {
    sessionsAbort?.abort()
    const ac = new AbortController()
    sessionsAbort = ac
    const gen = ++sessionsFetchGen

    set({ loading: true, fetchError: null })

    try {
      const sessions = await api.getSessions(ac.signal)
      if (ac.signal.aborted || gen !== sessionsFetchGen) return
      set({ sessions, loading: false, fetchError: null })
    } catch (e) {
      if (ac.signal.aborted || gen !== sessionsFetchGen) return
      const message =
        e instanceof Error ? e.message : 'Failed to load sessions'
      set({ loading: false, fetchError: message })
    }
  },

  fetchSessionDetail: async (tool: string, id: string) => {
    try {
      return await api.getSessionDetail(tool, id)
    } catch {
      return null
    }
  },
}))

export function useFilteredSessions(): SessionSummary[] {
  const sessions = useSessionStore((s) => s.sessions)
  const filters = useSessionStore((s) => s.filters)

  return sessions.filter((s) => {
    if (filters.tool !== 'all' && s.tool !== filters.tool) return false
    if (filters.source !== 'all') {
      const src = s.dataSource ?? 'local'
      if (filters.source === 'proxy' && src !== 'proxy' && src !== 'local+proxy') return false
      if (filters.source === 'local' && src === 'proxy') return false
    }
    if (
      filters.search &&
      !s.title.toLowerCase().includes(filters.search.toLowerCase()) &&
      !s.project.toLowerCase().includes(filters.search.toLowerCase())
    )
      return false
    return true
  })
}
