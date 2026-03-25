import { useState } from 'react'
import type { Turn, ContentBlock, ToolCall } from '@shared/types'
import ToolCallCard from './ToolCallCard'

interface Props {
  turn: Turn
  expanded: boolean
  onToggle: () => void
}

const roleConfig = {
  user: { icon: '👤', color: 'border-blue-500/30', label: 'User' },
  assistant: { icon: '🤖', color: 'border-indigo-500/30', label: 'Assistant' },
  system: { icon: '⚙️', color: 'border-zinc-500/30', label: 'System' },
}

export default function TurnCard({ turn, expanded, onToggle }: Props) {
  const cfg = roleConfig[turn.role] ?? roleConfig.system
  const hasToolCalls = turn.blocks.some((b) => b.type === 'tool_use')
  const hasThinking = turn.blocks.some((b) => b.type === 'thinking')
  const textBlocks = turn.blocks.filter((b) => b.type === 'text')
  const preview = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n').slice(0, 300)

  return (
    <div className="relative pl-10">
      <div className={`absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 ${cfg.color} bg-zinc-950 z-10`} />

      <div
        onClick={onToggle}
        className={`p-3 rounded-lg border border-zinc-800/50 cursor-pointer transition-colors ${
          expanded ? 'bg-zinc-900' : 'hover:bg-zinc-900/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs">{cfg.icon}</span>
          <span className="text-xs font-medium text-zinc-400">{cfg.label}</span>
          {hasToolCalls && (
            <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-400 rounded">
              {turn.blocks.filter((b) => b.type === 'tool_use').length} tools
            </span>
          )}
          {hasThinking && (
            <span className="px-1.5 py-0.5 text-[10px] bg-zinc-500/10 text-zinc-400 rounded">
              thinking
            </span>
          )}
          {turn.tokenUsage && turn.tokenUsage.totalTokens > 0 && (
            <span className="text-[10px] text-zinc-600 ml-auto">
              {turn.tokenUsage.totalTokens.toLocaleString()} tokens
            </span>
          )}
        </div>

        {!expanded && preview && (
          <p className="text-xs text-zinc-500 truncate">{preview}</p>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {turn.blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  const [showFull, setShowFull] = useState(false)

  if (block.type === 'text') {
    const text = block.text
    if (!text) return null
    const isLong = text.length > 500
    return (
      <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
        {isLong && !showFull ? text.slice(0, 500) + '...' : text}
        {isLong && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowFull(!showFull) }}
            className="ml-1 text-indigo-400 text-xs hover:underline"
          >
            {showFull ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    )
  }

  if (block.type === 'thinking') {
    return (
      <details className="group" onClick={(e) => e.stopPropagation()}>
        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
          💭 Thinking...
        </summary>
        <div className="mt-1 pl-4 border-l-2 border-zinc-800 text-xs text-zinc-500 whitespace-pre-wrap max-h-96 overflow-y-auto">
          {block.thinking}
        </div>
      </details>
    )
  }

  if (block.type === 'tool_use') {
    return <ToolCallCard toolCall={block.toolCall} />
  }

  if (block.type === 'tool_result') {
    return (
      <div className="text-xs text-zinc-500 bg-zinc-900 rounded p-2 max-h-48 overflow-y-auto">
        <span className="text-zinc-600">Result: </span>
        {block.result.slice(0, 1000)}
      </div>
    )
  }

  return null
}
