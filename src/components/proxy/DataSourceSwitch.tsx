import { useProxyStore } from '../../stores/proxyStore'
import { useSessionStore } from '../../stores/sessionStore'

const options = [
  { value: 'all' as const, label: 'All Sources', desc: 'Show sessions from both local agent data and proxy captures' },
  { value: 'local' as const, label: 'Local Only', desc: 'Show only sessions parsed from agent local files and databases' },
  { value: 'proxy' as const, label: 'Proxy Only', desc: 'Show only sessions captured through the API proxy' },
]

export default function DataSourceSwitch() {
  const { status, updateConfig } = useProxyStore()
  const setFilters = useSessionStore((s) => s.setFilters)

  if (!status) return null

  const current = status.dataSourcePreference

  const handleChange = (value: 'all' | 'local' | 'proxy') => {
    updateConfig({ dataSourcePreference: value })
    setFilters({ source: value })
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">Data Source</h3>
      <p className="text-xs text-zinc-600 mb-3">
        Choose which data sources to display in the Sessions view. This setting persists across restarts.
      </p>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
              current === opt.value
                ? 'border-indigo-500/40 bg-indigo-500/10 text-zinc-200'
                : 'border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                current === opt.value ? 'bg-indigo-400' : 'bg-zinc-700'
              }`} />
              <span className="text-xs font-medium">{opt.label}</span>
            </div>
            <p className="text-[10px] text-zinc-600 ml-4 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
