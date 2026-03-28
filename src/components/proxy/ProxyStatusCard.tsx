import { useProxyStore } from '../../stores/proxyStore'

export default function ProxyStatusCard() {
  const { status, loading, error, startProxy, stopProxy } = useProxyStore()

  if (!status) {
    return (
      <div className="border border-zinc-800 rounded-lg p-6 text-center text-zinc-500">
        Loading proxy status...
      </div>
    )
  }

  const isRunning = status.running

  return (
    <div className={`border rounded-lg p-4 ${isRunning ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          <div>
            <p className="text-sm font-medium">
              {isRunning ? 'Proxy Running' : 'Proxy Stopped'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isRunning
                ? `Listening on port ${status.port}`
                : 'Start the proxy to capture API traffic'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isRunning ? (
            <button
              onClick={() => stopProxy()}
              disabled={loading}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Stopping...' : 'Stop'}
            </button>
          ) : (
            <button
              onClick={() => startProxy()}
              disabled={loading}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Proxy'}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{error}</p>
      )}
    </div>
  )
}
