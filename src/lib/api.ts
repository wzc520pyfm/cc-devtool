import type { SessionSummary, Session, RawFileResponse } from '@shared/types'

const BASE = '/api'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function putJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface ProxyStatus {
  running: boolean
  port: number
  anthropicUpstream: string
  openaiUpstream: string
  autoStart: boolean
  dataSourcePreference: 'all' | 'local' | 'proxy'
  captureCount: number
  capturesDiskBytes: number
  lastCaptureTime: string | null
}

export interface ProxyConfig {
  port?: number
  anthropicUpstream?: string
  openaiUpstream?: string
  autoStart?: boolean
  dataSourcePreference?: 'all' | 'local' | 'proxy'
}

export const api = {
  getSessions: () => fetchJSON<SessionSummary[]>('/sessions'),
  getSessionDetail: (tool: string, id: string) =>
    fetchJSON<Session>(`/sessions/${tool}/${encodeURIComponent(id)}`),
  getRawFile: (tool: string, id: string) =>
    fetchJSON<RawFileResponse>(`/sessions/${tool}/${encodeURIComponent(id)}/raw`),

  getProxyStatus: () => fetchJSON<ProxyStatus>('/proxy/status'),
  startProxy: (config?: ProxyConfig) => postJSON<ProxyStatus>('/proxy/start', config),
  stopProxy: () => postJSON<ProxyStatus>('/proxy/stop'),
  updateProxyConfig: (config: ProxyConfig) => putJSON<ProxyConfig>('/proxy/config', config),
}
