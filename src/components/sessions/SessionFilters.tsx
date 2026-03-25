import { useSessionStore } from '../../stores/sessionStore'
import type { ToolSource } from '@shared/types'

const tools: { value: ToolSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Tools' },
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'codex', label: 'Codex' },
]

export default function SessionFilters() {
  const { filters, setFilters, sessions } = useSessionStore()

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
      <div className="flex gap-1">
        {tools.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilters({ tool: t.value })}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              filters.tool === t.value
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <input
        type="text"
        placeholder="Search sessions..."
        value={filters.search}
        onChange={(e) => setFilters({ search: e.target.value })}
        className="w-64 px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
      />
      <span className="text-xs text-zinc-600">{sessions.length} sessions</span>
    </div>
  )
}
