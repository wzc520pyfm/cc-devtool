import { useProxyStore } from '../../stores/proxyStore'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function CaptureStats() {
  const { status } = useProxyStore()

  if (!status) return null

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Capture Statistics</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-zinc-100">{status.captureCount}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Total Captures</p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-zinc-100">{formatBytes(status.capturesDiskBytes)}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Disk Usage</p>
          </div>
        </div>
        {status.lastCaptureTime && (
          <div className="text-xs text-zinc-500">
            Last capture: <span className="text-zinc-400">{formatRelativeTime(status.lastCaptureTime)}</span>
          </div>
        )}
        {status.captureCount === 0 && (
          <div className="text-xs text-zinc-600 bg-zinc-900/30 rounded p-2">
            No captures yet. Start the proxy and point your AI agent to it.
          </div>
        )}
      </div>
    </div>
  )
}
