import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import type { Session, ToolCategory, ToolCall } from '@shared/types'

interface Props {
  session: Session
}

const categoryColors: Record<ToolCategory, string> = {
  file_read: '#3b82f6',
  file_write: '#22c55e',
  shell: '#f97316',
  search: '#a855f7',
  skill: '#eab308',
  mcp: '#06b6d4',
  agent: '#ec4899',
  other: '#71717a',
}

const categoryLabels: Record<ToolCategory, string> = {
  file_read: 'File Read',
  file_write: 'File Write',
  shell: 'Shell',
  search: 'Search',
  skill: 'Skill',
  mcp: 'MCP',
  agent: 'Agent',
  other: 'Other',
}

const tooltipStyle = {
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#fafafa',
  fontSize: 12,
}

function extractAllToolCalls(session: Session): ToolCall[] {
  return session.turns.flatMap((t) =>
    t.blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => (b as { type: 'tool_use'; toolCall: ToolCall }).toolCall),
  )
}

export default function ToolDashboard({ session }: Props) {
  const allToolCalls = extractAllToolCalls(session)

  const categoryCounts = new Map<ToolCategory, number>()
  for (const tc of allToolCalls) {
    categoryCounts.set(tc.category, (categoryCounts.get(tc.category) ?? 0) + 1)
  }

  const readFiles = session.fileOps.filter((op) => op.type === 'read')
  const writeFiles = session.fileOps.filter((op) => op.type !== 'read')
  const shellCmds = allToolCalls.filter((tc) => tc.category === 'shell')

  const barData = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      name: categoryLabels[category],
      count,
      fill: categoryColors[category],
    }))
    .sort((a, b) => b.count - a.count)

  const pieData = barData.map((d) => ({
    name: d.name,
    value: d.count,
    fill: d.fill,
  }))

  const tokenData = session.turns
    .filter((t) => t.tokenUsage && t.tokenUsage.totalTokens > 0)
    .map((t, i) => ({
      turn: i + 1,
      input: t.tokenUsage!.inputTokens,
      output: t.tokenUsage!.outputTokens,
      cache: t.tokenUsage!.cacheReadTokens + t.tokenUsage!.cacheCreationTokens,
      total: t.tokenUsage!.totalTokens,
    }))

  let cumulativeTokens = 0
  const cumulativeData = tokenData.map((d) => {
    cumulativeTokens += d.total
    return { ...d, cumulative: cumulativeTokens }
  })

  const { totalTokens, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens } = session.tokenUsage

  return (
    <div className="p-4 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard label="Tool Calls" value={allToolCalls.length} />
        <StatCard label="Files Read" value={readFiles.length} color="text-blue-400" />
        <StatCard label="Files Written" value={writeFiles.length} color="text-green-400" />
        <StatCard label="Shell Cmds" value={shellCmds.length} color="text-orange-400" />
        <StatCard label="Skills" value={session.skillHits.length} color="text-yellow-400" />
        <StatCard label="Rules" value={session.ruleRefs.length} color="text-indigo-400" />
      </div>

      {/* Token Summary */}
      {totalTokens > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Token Consumption</h3>
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-100">{totalTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-sky-400">{inputTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Input</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{outputTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Output</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-400">{cacheCreationTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Cache Write</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-violet-400">{cacheReadTokens.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Cache Read</p>
            </div>
          </div>
          {/* Token usage ratio bar */}
          {totalTokens > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
              <div className="bg-sky-500" style={{ width: `${(inputTokens / totalTokens) * 100}%` }} />
              <div className="bg-emerald-500" style={{ width: `${(outputTokens / totalTokens) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(cacheCreationTokens / totalTokens) * 100}%` }} />
              <div className="bg-violet-500" style={{ width: `${(cacheReadTokens / totalTokens) * 100}%` }} />
            </div>
          )}
          <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />Input</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Output</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Cache Write</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />Cache Read</span>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Tool Usage Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Category Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {pieData.map((d) => (
              <span key={d.name} className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Token Over Time */}
      {cumulativeData.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Token Usage Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cumulativeData}>
              <XAxis dataKey="turn" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="input" stackId="1" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.3} name="Input" />
              <Area type="monotone" dataKey="output" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.3} name="Output" />
              <Area type="monotone" dataKey="cache" stackId="1" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.3} name="Cache" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Shell Commands */}
      {shellCmds.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <span className="text-orange-400">$</span>
            Shell Commands ({shellCmds.length})
          </h3>
          <ShellCommandList commands={shellCmds} />
        </div>
      )}

      {/* Skills */}
      {session.skillHits.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <span className="text-yellow-400">*</span>
            Skills Invoked ({session.skillHits.length})
          </h3>
          <div className="space-y-1">
            {session.skillHits.map((hit, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-yellow-500/5 border border-yellow-500/10">
                <span className="text-yellow-400 font-medium shrink-0">{hit.name}</span>
                {hit.fullPath && (
                  <span className="text-zinc-600 truncate text-[10px] font-mono">{hit.fullPath}</span>
                )}
                <span className="text-zinc-700 ml-auto shrink-0">{hit.agentId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {session.ruleRefs.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <span className="text-indigo-400">#</span>
            Rules Referenced ({session.ruleRefs.length})
          </h3>
          <div className="space-y-1">
            {session.ruleRefs.map((ref, i) => {
              const parts = ref.path.split('/')
              const fileName = parts.pop() ?? ref.path
              const dir = parts.join('/')
              return (
                <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-indigo-500/5 border border-indigo-500/10">
                  <span className="text-indigo-400 font-medium">{fileName}</span>
                  {dir && <span className="text-zinc-600 truncate text-[10px] font-mono">{dir}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MCP */}
      {session.mcpCalls.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <span className="text-cyan-400">~</span>
            MCP Tool Calls ({session.mcpCalls.length})
          </h3>
          <div className="space-y-1">
            {session.mcpCalls.map((call, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-cyan-500/5 border border-cyan-500/10">
                <span className="text-cyan-400 font-medium">{call.server}</span>
                <span className="text-zinc-400">{call.toolName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShellCommandList({ commands }: { commands: ToolCall[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {commands.map((cmd, i) => {
        const command = (cmd.input.command ?? cmd.input.cmd ?? '') as string
        const desc = (cmd.input.description ?? '') as string
        const isExpanded = expanded.has(i)
        return (
          <div
            key={i}
            className="rounded bg-zinc-900 border border-zinc-800/50 overflow-hidden"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
            >
              <span className="text-orange-400 font-mono text-xs shrink-0 mt-0.5">$</span>
              <div className="flex-1 min-w-0">
                <code className="text-xs text-zinc-300 font-mono break-all">
                  {command.length > 120 && !isExpanded ? command.slice(0, 120) + '...' : command}
                </code>
                {desc && <p className="text-[10px] text-zinc-600 mt-0.5">{desc}</p>}
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0">{isExpanded ? '▼' : '▶'}</span>
            </button>
            {isExpanded && cmd.result && (
              <div className="border-t border-zinc-800/50 px-3 py-2">
                <pre className="text-[11px] text-zinc-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {cmd.result.slice(0, 3000)}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatCard({
  label,
  value,
  color = 'text-zinc-100',
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="border border-zinc-800 rounded-lg p-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}
