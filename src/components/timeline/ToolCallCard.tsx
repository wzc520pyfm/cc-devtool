import { useState } from 'react'
import type { ToolCall, ToolCategory } from '@shared/types'

const categoryConfig: Record<ToolCategory, { icon: string; color: string; bg: string }> = {
  file_read: { icon: '📖', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  file_write: { icon: '✏️', color: 'text-green-400', bg: 'bg-green-500/10' },
  shell: { icon: '💻', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  search: { icon: '🔍', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  skill: { icon: '⭐', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  mcp: { icon: '🔌', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  agent: { icon: '🤖', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  other: { icon: '🔧', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
}

interface Props {
  toolCall: ToolCall
}

export default function ToolCallCard({ toolCall }: Props) {
  const [showDetails, setShowDetails] = useState(false)
  const cfg = categoryConfig[toolCall.category]

  const summary = getToolSummary(toolCall)

  return (
    <div
      className={`rounded-md border border-zinc-800 overflow-hidden ${cfg.bg}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <span className="text-sm">{cfg.icon}</span>
        <span className={`text-xs font-semibold ${cfg.color}`}>{toolCall.name}</span>
        <span className="text-xs text-zinc-500 truncate flex-1">{summary}</span>
        <span className="text-[10px] text-zinc-600">{showDetails ? '▼' : '▶'}</span>
      </button>

      {showDetails && (
        <div className="border-t border-zinc-800/50 px-3 py-2">
          <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Input</div>
          <pre className="text-xs text-zinc-400 overflow-x-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
          {toolCall.result && (
            <>
              <div className="text-[10px] text-zinc-500 mt-2 mb-1 uppercase tracking-wider">Result</div>
              <pre className="text-xs text-zinc-500 overflow-x-auto max-h-48 whitespace-pre-wrap">
                {toolCall.result.slice(0, 2000)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function getToolSummary(tc: ToolCall): string {
  switch (tc.name) {
    case 'Read':
      return (tc.input.path ?? tc.input.file_path ?? '') as string
    case 'Write':
      return (tc.input.path ?? tc.input.file_path ?? '') as string
    case 'StrReplace':
      return (tc.input.path ?? '') as string
    case 'Shell':
      return ((tc.input.command ?? '') as string).slice(0, 100)
    case 'Grep':
      return `/${tc.input.pattern ?? ''}/ in ${tc.input.path ?? '.'}`
    case 'Glob':
      return (tc.input.glob_pattern ?? '') as string
    case 'Skill':
      return (tc.input.skill ?? '') as string
    case 'CallMcpTool':
    case 'call_mcp_tool':
      return `${tc.input.server}:${tc.input.toolName}`
    case 'Task':
      return (tc.input.description ?? '') as string
    case 'SemanticSearch':
      return (tc.input.query ?? '') as string
    default:
      return ''
  }
}
