import { useProxyStore } from '../../stores/proxyStore'

export default function ProxyUsage() {
  const { status } = useProxyStore()

  if (!status) return null

  const port = status.port

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Usage Instructions</h3>
      <p className="text-xs text-zinc-500 mb-3">
        Point your AI agent's API base URL to the proxy. The proxy captures full session data — tool calls with parameters, assistant messages, thinking blocks, and token usage — then forwards requests upstream transparently.
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Claude Code / Claude CLI</p>
          <code className="block bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-emerald-400 font-mono select-all">
            ANTHROPIC_BASE_URL=http://localhost:{port}/anthropic claude
          </code>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Codex (OpenAI)</p>
          <code className="block bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-emerald-400 font-mono select-all">
            OPENAI_BASE_URL=http://localhost:{port}/openai codex
          </code>
        </div>

        <div className="border-t border-zinc-800 pt-3 mt-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">What Gets Captured</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-zinc-900/50 rounded px-2.5 py-1.5 text-xs text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Tool calls + parameters
            </div>
            <div className="bg-zinc-900/50 rounded px-2.5 py-1.5 text-xs text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Token usage
            </div>
            <div className="bg-zinc-900/50 rounded px-2.5 py-1.5 text-xs text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              Assistant text + thinking
            </div>
            <div className="bg-zinc-900/50 rounded px-2.5 py-1.5 text-xs text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              File ops / Skills / MCP
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-3 mt-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Chaining with cc-switch</p>
          <p className="text-xs text-zinc-500 mb-2">
            If you use cc-switch, set cc-devtool's upstream to cc-switch, then point your agent to cc-devtool:
          </p>
          <div className="space-y-1.5">
            <code className="block bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-[11px] text-zinc-400 font-mono">
              <span className="text-zinc-600"># 1. Configure upstream to cc-switch</span>
            </code>
            <code className="block bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-[11px] text-zinc-400 font-mono">
              <span className="text-zinc-600"># 2. Agent</span> {'-->'} <span className="text-emerald-400">cc-devtool :{port}</span> {'-->'} <span className="text-amber-400">cc-switch</span> {'-->'} <span className="text-sky-400">API provider</span>
            </code>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-3 mt-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Cursor Limitation</p>
          <p className="text-xs text-zinc-600">
            Cursor routes API calls through its own internal proxy. The cc-devtool proxy cannot intercept Cursor's API traffic. For Cursor, data is collected passively from local transcript files and the AI tracking SQLite database.
          </p>
        </div>
      </div>
    </div>
  )
}
