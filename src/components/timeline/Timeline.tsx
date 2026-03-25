import { useState } from 'react'
import type { Session, Turn } from '@shared/types'
import TurnCard from './TurnCard'

interface Props {
  session: Session
}

export default function Timeline({ session }: Props) {
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set())
  const [filterAgent, setFilterAgent] = useState<string | null>(null)

  const filteredTurns = filterAgent
    ? session.turns.filter((t) => t.agentId === filterAgent)
    : session.turns

  const toggleExpand = (id: string) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-4">
      {session.agents.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-zinc-500">Filter by agent:</span>
          <button
            onClick={() => setFilterAgent(null)}
            className={`px-2 py-0.5 text-xs rounded ${
              !filterAgent ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          {session.agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setFilterAgent(a.id)}
              className={`px-2 py-0.5 text-xs rounded ${
                filterAgent === a.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />
        <div className="space-y-1">
          {filteredTurns.map((turn) => (
            <TurnCard
              key={turn.id}
              turn={turn}
              expanded={expandedTurns.has(turn.id)}
              onToggle={() => toggleExpand(turn.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
