import { useState, useEffect } from 'react'
import { useProxyStore } from '../../stores/proxyStore'

export default function ProxyConfig() {
  const { status, updateConfig } = useProxyStore()

  const [port, setPort] = useState('')
  const [anthropic, setAnthropic] = useState('')
  const [openai, setOpenai] = useState('')
  const [autoStart, setAutoStart] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (status) {
      setPort(String(status.port))
      setAnthropic(status.anthropicUpstream)
      setOpenai(status.openaiUpstream)
      setAutoStart(status.autoStart)
      setDirty(false)
    }
  }, [status])

  const handleSave = () => {
    updateConfig({
      port: parseInt(port, 10) || 4174,
      anthropicUpstream: anthropic,
      openaiUpstream: openai,
      autoStart,
    })
    setDirty(false)
  }

  const markDirty = () => setDirty(true)

  const ccSwitch = status?.ccSwitch
  const ccSwitchUrl = ccSwitch?.detected
    ? `http://${ccSwitch.address ?? '127.0.0.1'}:${ccSwitch.port}`
    : null

  const isUsingCcSwitch = ccSwitchUrl
    && anthropic.includes(`:${ccSwitch!.port}`)

  const applyCcSwitch = () => {
    if (!ccSwitchUrl) return
    setAnthropic(ccSwitchUrl)
    setOpenai(ccSwitchUrl)
    setDirty(true)
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Configuration</h3>
      <div className="space-y-3">
        {ccSwitch?.detected && !isUsingCcSwitch && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-400">cc-switch detected</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate font-mono">{ccSwitchUrl}</p>
              </div>
              <button
                onClick={applyCcSwitch}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
        {isUsingCcSwitch && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">Upstream routed through cc-switch</p>
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => { setPort(e.target.value); markDirty() }}
            className="w-full px-2.5 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded text-zinc-300 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Anthropic Upstream</label>
          <input
            type="text"
            value={anthropic}
            onChange={(e) => { setAnthropic(e.target.value); markDirty() }}
            placeholder="https://api.anthropic.com"
            className="w-full px-2.5 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded text-zinc-300 font-mono text-xs focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">OpenAI Upstream</label>
          <input
            type="text"
            value={openai}
            onChange={(e) => { setOpenai(e.target.value); markDirty() }}
            placeholder="https://api.openai.com"
            className="w-full px-2.5 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded text-zinc-300 font-mono text-xs focus:outline-none focus:border-zinc-600"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => { setAutoStart(e.target.checked); markDirty() }}
            className="rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-zinc-400">Auto-start proxy with server</span>
        </label>
        {dirty && (
          <button
            onClick={handleSave}
            className="w-full py-1.5 text-xs font-medium rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors"
          >
            Save Configuration
          </button>
        )}
        {status?.running && dirty && (
          <p className="text-[10px] text-zinc-600 italic">
            Restart the proxy after saving for changes to take effect.
          </p>
        )}
      </div>
    </div>
  )
}
