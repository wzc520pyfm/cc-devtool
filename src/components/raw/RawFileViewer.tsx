import { useState, useMemo } from 'react'
import type { RawFileResponse } from '@shared/types'

interface Props {
  data: RawFileResponse
}

type RecordFilter = 'all' | 'user' | 'assistant' | 'system' | 'tool_use'

export default function RawFileViewer({ data }: Props) {
  const [filter, setFilter] = useState<RecordFilter>('all')
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set())
  const [searchText, setSearchText] = useState('')

  const sizeLabel = data.size >= 1024 * 1024
    ? `${(data.size / 1024 / 1024).toFixed(1)} MB`
    : data.size >= 1024
      ? `${(data.size / 1024).toFixed(1)} KB`
      : `${data.size} B`

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 p-3 flex items-center gap-3 shrink-0">
        <code className="text-[10px] text-zinc-500 font-mono truncate flex-1">{data.filePath}</code>
        <span className="text-[10px] text-zinc-600">{sizeLabel}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">{data.format}</span>
      </div>

      <div className="border-b border-zinc-800 p-2 flex items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="bg-zinc-800/50 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 w-48 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        {data.format === 'jsonl' && (
          <div className="flex gap-1 ml-2">
            {(['all', 'user', 'assistant', 'system', 'tool_use'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  filter === f
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    : 'text-zinc-500 hover:text-zinc-400 border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setExpandedLines(new Set())}
          className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400"
        >
          Collapse All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {data.format === 'jsonl' ? (
          <JsonlView
            content={data.content}
            filter={filter}
            searchText={searchText}
            expandedLines={expandedLines}
            setExpandedLines={setExpandedLines}
          />
        ) : (
          <TxtView content={data.content} searchText={searchText} />
        )}
      </div>
    </div>
  )
}

function JsonlView({
  content,
  filter,
  searchText,
  expandedLines,
  setExpandedLines,
}: {
  content: string
  filter: RecordFilter
  searchText: string
  expandedLines: Set<number>
  setExpandedLines: React.Dispatch<React.SetStateAction<Set<number>>>
}) {
  const lines = useMemo(() => {
    const raw = content.split('\n').filter((l) => l.trim())
    return raw.map((line, i) => {
      try {
        const obj = JSON.parse(line)
        return { idx: i, raw: line, parsed: obj }
      } catch {
        return { idx: i, raw: line, parsed: null }
      }
    })
  }, [content])

  const filtered = useMemo(() => {
    let result = lines
    if (filter !== 'all') {
      result = result.filter((l) => {
        if (!l.parsed) return false
        const type = l.parsed.type ?? l.parsed.role ?? ''
        if (filter === 'tool_use') {
          const content = l.parsed.message?.content
          if (Array.isArray(content)) {
            return content.some((b: { type?: string }) => b.type === 'tool_use')
          }
          return l.parsed.payload?.type === 'function_call'
        }
        return type === filter
      })
    }
    if (searchText) {
      const lower = searchText.toLowerCase()
      result = result.filter((l) => l.raw.toLowerCase().includes(lower))
    }
    return result
  }, [lines, filter, searchText])

  const toggle = (idx: number) => {
    setExpandedLines((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  return (
    <div>
      {filtered.map((line) => {
        const isExpanded = expandedLines.has(line.idx)
        const recordType = line.parsed?.type ?? line.parsed?.role ?? '?'
        const typeColor = getTypeColor(recordType, line.parsed)

        return (
          <div
            key={line.idx}
            className="border-b border-zinc-800/50 hover:bg-zinc-800/20"
          >
            <button
              onClick={() => toggle(line.idx)}
              className="w-full flex items-start gap-2 px-3 py-1.5 text-left"
            >
              <span className="text-zinc-700 w-8 text-right shrink-0 select-none">
                {line.idx + 1}
              </span>
              <span className="text-zinc-600 w-3 shrink-0">{isExpanded ? '▼' : '▶'}</span>
              <span className={`px-1 rounded text-[9px] font-semibold shrink-0 ${typeColor}`}>
                {recordType}
              </span>
              {!isExpanded && (
                <span className="text-zinc-500 truncate">
                  {summarizeRecord(line.parsed, line.raw)}
                </span>
              )}
            </button>
            {isExpanded && (
              <pre className="pl-16 pr-4 pb-2 text-zinc-400 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                {line.parsed ? JSON.stringify(line.parsed, null, 2) : line.raw}
              </pre>
            )}
          </div>
        )
      })}
      {filtered.length === 0 && (
        <div className="p-8 text-center text-zinc-600">No matching records</div>
      )}
    </div>
  )
}

function TxtView({ content, searchText }: { content: string; searchText: string }) {
  const lines = useMemo(() => content.split('\n'), [content])

  const filteredLines = useMemo(() => {
    if (!searchText) return lines.map((l, i) => ({ line: l, idx: i }))
    const lower = searchText.toLowerCase()
    return lines
      .map((l, i) => ({ line: l, idx: i }))
      .filter(({ line }) => line.toLowerCase().includes(lower))
  }, [lines, searchText])

  return (
    <div>
      {filteredLines.map(({ line, idx }) => {
        const isToolCall = /^\[Tool call\]/.test(line)
        const isToolResult = /^\[Tool result\]/.test(line)
        const isThinking = /^\[Thinking\]/.test(line)
        const isRole = /^(user|assistant):/.test(line)

        let lineClass = 'text-zinc-500'
        if (isToolCall) lineClass = 'text-blue-400/80 bg-blue-500/5'
        else if (isToolResult) lineClass = 'text-green-400/80 bg-green-500/5'
        else if (isThinking) lineClass = 'text-purple-400/80'
        else if (isRole) lineClass = 'text-zinc-200 font-semibold'

        return (
          <div key={idx} className={`flex hover:bg-zinc-800/20 ${lineClass}`}>
            <span className="text-zinc-700 w-12 text-right pr-3 shrink-0 select-none py-px">
              {idx + 1}
            </span>
            <span className="py-px whitespace-pre-wrap break-all">{line}</span>
          </div>
        )
      })}
    </div>
  )
}

function getTypeColor(type: string, parsed: Record<string, unknown> | null): string {
  if (type === 'user') return 'bg-blue-500/15 text-blue-400'
  if (type === 'assistant') return 'bg-green-500/15 text-green-400'
  if (type === 'system') return 'bg-yellow-500/15 text-yellow-400'
  if (type === 'response_item') {
    const pt = (parsed?.payload as Record<string, unknown>)?.type
    if (pt === 'function_call') return 'bg-orange-500/15 text-orange-400'
    return 'bg-cyan-500/15 text-cyan-400'
  }
  if (type === 'event_msg') return 'bg-purple-500/15 text-purple-400'
  if (type === 'file-history-snapshot') return 'bg-zinc-500/15 text-zinc-500'
  if (type === 'progress') return 'bg-zinc-500/15 text-zinc-500'
  return 'bg-zinc-500/15 text-zinc-500'
}

function summarizeRecord(parsed: Record<string, unknown> | null, raw: string): string {
  if (!parsed) return raw.slice(0, 120)

  const type = (parsed.type ?? parsed.role ?? '') as string

  if (type === 'user') {
    const msg = parsed.message as Record<string, unknown> | undefined
    const content = msg?.content
    if (typeof content === 'string') return content.slice(0, 120)
    if (Array.isArray(content)) {
      const text = content.find((b: { type?: string }) => b.type === 'text')
      return (text as { text?: string })?.text?.slice(0, 120) ?? '...'
    }
  }

  if (type === 'assistant') {
    const msg = parsed.message as Record<string, unknown> | undefined
    const content = msg?.content
    if (Array.isArray(content)) {
      const types = content.map((b: { type?: string }) => b.type)
      return `[${types.join(', ')}]`
    }
  }

  if (type === 'response_item') {
    const payload = parsed.payload as Record<string, unknown> | undefined
    const pt = payload?.type as string | undefined
    if (pt === 'function_call') return `${payload?.name}()`
    if (payload?.role) return `role: ${payload.role}`
    return pt ?? '...'
  }

  if (type === 'event_msg') {
    const payload = parsed.payload as Record<string, unknown> | undefined
    return (payload?.type as string) ?? '...'
  }

  if (type === 'system') {
    return (parsed.subtype as string) ?? '...'
  }

  return raw.slice(0, 100)
}
