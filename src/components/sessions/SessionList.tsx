import { useNavigate } from 'react-router-dom'
import { useFilteredSessions } from '../../stores/sessionStore'
import type { SessionSummary } from '@shared/types'

const toolConfig: Record<string, { color: string; bg: string; border: string }> = {
  'claude-code': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  cursor: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  codex: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
}

export default function SessionList() {
  const navigate = useNavigate()
  const sessions = useFilteredSessions()

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
        <p className="text-lg">No sessions found</p>
        <p className="text-sm mt-1">Make sure you have Claude Code, Cursor, or Codex installed</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <SessionCard
          key={`${session.tool}-${session.id}`}
          session={session}
          onClick={() => navigate(`/session/${session.tool}/${encodeURIComponent(session.id)}`)}
        />
      ))}
    </div>
  )
}

function SessionCard({
  session,
  onClick,
}: {
  session: SessionSummary
  onClick: () => void
}) {
  const cfg = toolConfig[session.tool] ?? toolConfig.cursor
  const startDate = new Date(session.startTime)
  const isActive = session.status === 'active'

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {session.tool}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Active
              </span>
            )}
            {session.model && (
              <span className="text-[10px] text-zinc-600">{session.model}</span>
            )}
          </div>
          <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-zinc-100">
            {session.title}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5 truncate">{session.project}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-zinc-500">{formatDate(startDate)}</p>
          <p className="text-[10px] text-zinc-600 mt-1">{formatTime(startDate)}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-500">
        <span>{session.turnCount} turns</span>
        {session.hasToolData ? (
          <>
            <span>{session.toolCallCount} tools</span>
            <span>{session.fileOpCount} files</span>
            {session.agentCount > 1 && <span>{session.agentCount} agents</span>}
          </>
        ) : (
          <span className="text-zinc-600 italic">tool data unavailable</span>
        )}
        {session.tokenUsage.totalTokens > 0 && (
          <span>{formatTokens(session.tokenUsage.totalTokens)}</span>
        )}
      </div>
    </button>
  )
}

function formatDate(d: Date): string {
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString()
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K tokens`
  return `${n} tokens`
}
