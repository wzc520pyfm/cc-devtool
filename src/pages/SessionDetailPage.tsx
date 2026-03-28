import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import Timeline from '../components/timeline/Timeline'
import FileImpactView from '../components/file-impact/FileImpactView'
import AgentGraph from '../components/agent-graph/AgentGraph'
import ToolDashboard from '../components/dashboard/ToolDashboard'
import RawFileViewer from '../components/raw/RawFileViewer'
import { api } from '../lib/api'
import type { Session, RawFileResponse } from '@shared/types'

const tabs = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'files', label: 'File Impact' },
  { id: 'agents', label: 'Agent Graph' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'raw', label: 'Raw' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function SessionDetailPage() {
  const { tool, id } = useParams<{ tool: string; id: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('timeline')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [rawData, setRawData] = useState<RawFileResponse | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { fetchSessionDetail } = useSessionStore()

  useEffect(() => {
    if (tool && id) {
      setLoading(true)
      setActiveTab('timeline')
      setRawData(null)
      fetchSessionDetail(tool, id).then((s) => {
        setSession(s)
        setLoading(false)
      })
    }
  }, [tool, id, fetchSessionDetail])

  const loadRaw = () => {
    if (rawData || !tool || !id) return
    api.getRawFile(tool, id).then(setRawData).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Loading session...
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Session not found
      </div>
    )
  }

  const toolColors: Record<string, string> = {
    'claude-code': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    cursor: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    codex: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  }

  const readCount = session.fileOps.filter((op) => op.type === 'read').length
  const writeCount = session.fileOps.filter((op) => op.type !== 'read').length
  const shellCount = session.turns
    .flatMap((t) => t.blocks)
    .filter((b) => b.type === 'tool_use' && (b as { type: 'tool_use'; toolCall: { category: string } }).toolCall.category === 'shell')
    .length
  const totalToolCalls = session.turns
    .flatMap((t) => t.blocks)
    .filter((b) => b.type === 'tool_use')
    .length

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded border ${toolColors[session.tool] ?? ''}`}
          >
            {session.tool}
          </span>
          {session.id.startsWith('proxy-') && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded border text-rose-400 bg-rose-500/10 border-rose-500/30">
              proxy
            </span>
          )}
          <h2 className="text-lg font-semibold truncate flex-1">
            {session.title || session.project}
          </h2>
          {session.model && (
            <span className="text-[10px] text-zinc-600 font-mono bg-zinc-800/50 px-2 py-0.5 rounded">
              {session.model}
            </span>
          )}
          <button
            onClick={() => { loadRaw(); setDrawerOpen(true) }}
            className="text-xs text-zinc-600 hover:text-zinc-300 font-mono bg-zinc-800/50 hover:bg-zinc-700/50 px-2 py-0.5 rounded transition-colors"
            title="View raw file"
          >
            {'</>'}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
          <span>{new Date(session.startTime).toLocaleString()}</span>
          <span className="text-zinc-700">|</span>
          <span>{session.turns.length} turns</span>
          <span>{totalToolCalls} tool calls</span>
          <span className="text-blue-400/70">{readCount} reads</span>
          <span className="text-green-400/70">{writeCount} writes</span>
          <span className="text-orange-400/70">{shellCount} cmds</span>
          {session.skillHits.length > 0 && (
            <span className="text-yellow-400/70">{session.skillHits.length} skills</span>
          )}
          {session.ruleRefs.length > 0 && (
            <span className="text-indigo-400/70">{session.ruleRefs.length} rules</span>
          )}
          {session.tokenUsage.totalTokens > 0 && (
            <>
              <span className="text-zinc-700">|</span>
              <span>{session.tokenUsage.totalTokens.toLocaleString()} tokens</span>
            </>
          )}
        </div>
      </div>

      <div className="border-b border-zinc-800 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'raw') loadRaw()
            }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timeline' && <Timeline session={session} />}
        {activeTab === 'files' && <FileImpactView session={session} />}
        {activeTab === 'agents' && <AgentGraph session={session} />}
        {activeTab === 'dashboard' && <ToolDashboard session={session} />}
        {activeTab === 'raw' && (
          rawData ? <RawFileViewer data={rawData} /> : <div className="flex items-center justify-center h-full text-zinc-500">Loading raw file...</div>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-[55vw] max-w-4xl bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-zinc-800 shrink-0">
              <span className="text-sm font-medium text-zinc-300">Raw File</span>
              <button onClick={() => setDrawerOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-lg px-2">&times;</button>
            </div>
            <div className="flex-1 overflow-hidden">
              {rawData ? <RawFileViewer data={rawData} /> : <div className="flex items-center justify-center h-full text-zinc-500">Loading...</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
