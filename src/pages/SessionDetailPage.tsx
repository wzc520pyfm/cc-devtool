import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import Timeline from '../components/timeline/Timeline'
import FileImpactView from '../components/file-impact/FileImpactView'
import AgentGraph from '../components/agent-graph/AgentGraph'
import ToolDashboard from '../components/dashboard/ToolDashboard'
import type { Session } from '@shared/types'

const tabs = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'files', label: 'File Impact' },
  { id: 'agents', label: 'Agent Graph' },
  { id: 'dashboard', label: 'Dashboard' },
] as const

type TabId = (typeof tabs)[number]['id']

export default function SessionDetailPage() {
  const { tool, id } = useParams<{ tool: string; id: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('timeline')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { fetchSessionDetail } = useSessionStore()

  useEffect(() => {
    if (tool && id) {
      setLoading(true)
      setActiveTab('timeline')
      fetchSessionDetail(tool, id).then((s) => {
        setSession(s)
        setLoading(false)
      })
    }
  }, [tool, id, fetchSessionDetail])

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

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded border ${toolColors[session.tool] ?? ''}`}
          >
            {session.tool}
          </span>
          <h2 className="text-lg font-semibold truncate">
            {session.title || session.project}
          </h2>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
          <span>{new Date(session.startTime).toLocaleString()}</span>
          <span>{session.turns.length} turns</span>
          <span>{session.fileOps.length} file ops</span>
          {session.tokenUsage.totalTokens > 0 && (
            <span>{session.tokenUsage.totalTokens.toLocaleString()} tokens</span>
          )}
        </div>
      </div>

      <div className="border-b border-zinc-800 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
      </div>
    </div>
  )
}
