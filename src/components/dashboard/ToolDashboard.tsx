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
} from 'recharts'
import type { Session, ToolCategory } from '@shared/types'

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

export default function ToolDashboard({ session }: Props) {
  const allToolCalls = session.turns.flatMap((t) =>
    t.blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => (b as { type: 'tool_use'; toolCall: { category: ToolCategory; name: string } }).toolCall),
  )

  const categoryCounts = new Map<ToolCategory, number>()
  for (const tc of allToolCalls) {
    categoryCounts.set(tc.category, (categoryCounts.get(tc.category) ?? 0) + 1)
  }

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
      total: t.tokenUsage!.totalTokens,
    }))

  let cumulativeTokens = 0
  const cumulativeData = tokenData.map((d) => {
    cumulativeTokens += d.total
    return { ...d, cumulative: cumulativeTokens }
  })

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Tool Calls" value={allToolCalls.length} />
        <StatCard label="Skills Used" value={session.skillHits.length} color="text-yellow-400" />
        <StatCard label="MCP Calls" value={session.mcpCalls.length} color="text-cyan-400" />
        <StatCard
          label="Total Tokens"
          value={session.tokenUsage.totalTokens.toLocaleString()}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Tool Usage Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  color: '#fafafa',
                  fontSize: 12,
                }}
              />
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
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  color: '#fafafa',
                  fontSize: 12,
                }}
              />
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

      {cumulativeData.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Token Usage Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cumulativeData}>
              <XAxis dataKey="turn" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  color: '#fafafa',
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {session.skillHits.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            ⭐ Skills Invoked
          </h3>
          <div className="space-y-1">
            {session.skillHits.map((hit, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-yellow-500/5">
                <span className="text-yellow-400 font-medium">{hit.name}</span>
                <span className="text-zinc-600">{hit.agentId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session.mcpCalls.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            🔌 MCP Tool Calls
          </h3>
          <div className="space-y-1">
            {session.mcpCalls.map((call, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-cyan-500/5">
                <span className="text-cyan-400 font-medium">{call.server}</span>
                <span className="text-zinc-400">{call.toolName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session.ruleRefs.length > 0 && (
        <div className="border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">📋 Rules Referenced</h3>
          <div className="space-y-1">
            {session.ruleRefs.map((ref, i) => (
              <div key={i} className="text-xs text-zinc-400 px-2 py-1">{ref.path}</div>
            ))}
          </div>
        </div>
      )}
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
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}
