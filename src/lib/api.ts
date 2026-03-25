import type { SessionSummary, Session } from '@shared/types'

const BASE = '/api'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  getSessions: () => fetchJSON<SessionSummary[]>('/sessions'),
  getSessionDetail: (tool: string, id: string) =>
    fetchJSON<Session>(`/sessions/${tool}/${encodeURIComponent(id)}`),
}
