import { useState, useEffect, useMemo } from 'react'
import { useProxyStore } from '../../stores/proxyStore'
import {
  DIRECT_PRESET,
  ccSwitchPreset,
  loadUserPresets,
  saveUserPresets,
  presetsEqual,
  makePresetId,
  type ProxyPreset,
} from '../../lib/proxyPresets'

const LAST_NON_CCSWITCH_KEY = 'cc-devtool:proxy-last-non-ccswitch'

interface NonCcSwitchSnapshot {
  anthropic: string
  openai: string
}

function loadLastNonCcSwitch(): NonCcSwitchSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_NON_CCSWITCH_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (typeof v?.anthropic === 'string' && typeof v?.openai === 'string') return v
  } catch { /* ignore */ }
  return null
}

function saveLastNonCcSwitch(snap: NonCcSwitchSnapshot): void {
  try {
    localStorage.setItem(LAST_NON_CCSWITCH_KEY, JSON.stringify(snap))
  } catch { /* ignore */ }
}

export default function ProxyConfig() {
  const { status, updateConfig, restartProxy, loading } = useProxyStore()

  const [port, setPort] = useState('')
  const [anthropic, setAnthropic] = useState('')
  const [openai, setOpenai] = useState('')
  const [autoStart, setAutoStart] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [userPresets, setUserPresets] = useState<ProxyPreset[]>([])

  useEffect(() => {
    setUserPresets(loadUserPresets())
  }, [])

  useEffect(() => {
    if (status) {
      setPort(String(status.port))
      setAnthropic(status.anthropicUpstream)
      setOpenai(status.openaiUpstream)
      setAutoStart(status.autoStart)
      setDirty(false)
    }
  }, [status])

  const ccSwitch = status?.ccSwitch
  const ccSwitchUrl = ccSwitch?.detected
    ? `http://${ccSwitch.address ?? '127.0.0.1'}:${ccSwitch.port}`
    : null

  const isUsingCcSwitch = Boolean(
    ccSwitchUrl && anthropic === ccSwitchUrl && openai === ccSwitchUrl,
  )

  const presets: ProxyPreset[] = useMemo(() => {
    const list: ProxyPreset[] = [DIRECT_PRESET]
    if (ccSwitchUrl) list.push(ccSwitchPreset(ccSwitchUrl))
    return [...list, ...userPresets]
  }, [ccSwitchUrl, userPresets])

  const activePresetId = useMemo(() => {
    return presets.find((p) => presetsEqual(p, anthropic, openai))?.id ?? null
  }, [presets, anthropic, openai])

  const markDirty = () => setDirty(true)

  const applyPreset = (preset: ProxyPreset) => {
    if (!isUsingCcSwitch && preset.builtin === 'cc-switch') {
      saveLastNonCcSwitch({ anthropic, openai })
    }
    setAnthropic(preset.anthropicUpstream)
    setOpenai(preset.openaiUpstream)
    setDirty(true)
  }

  const toggleCcSwitch = () => {
    if (!ccSwitchUrl) return
    if (isUsingCcSwitch) {
      const last = loadLastNonCcSwitch()
      const target = last && (last.anthropic !== ccSwitchUrl || last.openai !== ccSwitchUrl)
        ? last
        : { anthropic: DIRECT_PRESET.anthropicUpstream, openai: DIRECT_PRESET.openaiUpstream }
      setAnthropic(target.anthropic)
      setOpenai(target.openai)
    } else {
      saveLastNonCcSwitch({ anthropic, openai })
      setAnthropic(ccSwitchUrl)
      setOpenai(ccSwitchUrl)
    }
    setDirty(true)
  }

  const handleSave = async () => {
    const config = {
      port: parseInt(port, 10) || 4174,
      anthropicUpstream: anthropic,
      openaiUpstream: openai,
      autoStart,
    }
    await updateConfig(config)
    setDirty(false)
  }

  const handleSaveAndRestart = async () => {
    const config = {
      port: parseInt(port, 10) || 4174,
      anthropicUpstream: anthropic,
      openaiUpstream: openai,
      autoStart,
    }
    await updateConfig(config)
    await restartProxy(config)
    setDirty(false)
  }

  const handleSaveCurrentAsPreset = () => {
    const name = window.prompt('Preset name:')?.trim()
    if (!name) return
    const next: ProxyPreset[] = [
      ...userPresets,
      {
        id: makePresetId(),
        name,
        anthropicUpstream: anthropic,
        openaiUpstream: openai,
      },
    ]
    setUserPresets(next)
    saveUserPresets(next)
  }

  const handleDeletePreset = (id: string) => {
    const next = userPresets.filter((p) => p.id !== id)
    setUserPresets(next)
    saveUserPresets(next)
  }

  const currentMatchesAPreset = activePresetId !== null
  const isRunning = Boolean(status?.running)

  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Configuration</h3>
      <div className="space-y-3">
        {ccSwitchUrl && (
          <CcSwitchToggle
            url={ccSwitchUrl}
            on={isUsingCcSwitch}
            onToggle={toggleCcSwitch}
          />
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Presets</label>
            {!currentMatchesAPreset && (
              <button
                onClick={handleSaveCurrentAsPreset}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
                title="Save current upstream as a named preset"
              >
                + Save current
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <PresetChip
                key={preset.id}
                preset={preset}
                active={preset.id === activePresetId}
                onApply={() => applyPreset(preset)}
                onDelete={preset.builtin ? undefined : () => handleDeletePreset(preset.id)}
              />
            ))}
            {presets.length === 1 && (
              <span className="text-[10px] text-zinc-600 italic self-center">
                Save the current upstream as a preset to switch quickly later
              </span>
            )}
          </div>
        </div>

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
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-1.5 text-xs font-medium rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
            >
              Save
            </button>
            {isRunning && (
              <button
                onClick={handleSaveAndRestart}
                disabled={loading}
                className="flex-1 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                title="Save and restart the proxy so changes take effect immediately"
              >
                Save &amp; Restart
              </button>
            )}
          </div>
        )}
        {!dirty && isRunning && (
          <p className="text-[10px] text-zinc-600 italic">
            Proxy is running. Apply a preset or edit fields to save & restart.
          </p>
        )}
      </div>
    </div>
  )
}

function CcSwitchToggle({
  url,
  on,
  onToggle,
}: {
  url: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${
        on
          ? 'bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-xs font-medium ${on ? 'text-emerald-400' : 'text-zinc-300'}`}>
            Route via cc-switch
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5 truncate font-mono">{url}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center h-5 w-9 rounded-full transition-colors ${
            on ? 'bg-emerald-500/40' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
              on ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </span>
      </div>
    </button>
  )
}

function PresetChip({
  preset,
  active,
  onApply,
  onDelete,
}: {
  preset: ProxyPreset
  active: boolean
  onApply: () => void
  onDelete?: () => void
}) {
  const baseClass = active
    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'

  return (
    <span
      className={`group inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border ${baseClass}`}
      title={`${preset.anthropicUpstream}${
        preset.openaiUpstream !== preset.anthropicUpstream ? ` / ${preset.openaiUpstream}` : ''
      }`}
    >
      <button
        type="button"
        onClick={onApply}
        className="font-medium"
      >
        {preset.name}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`Delete preset "${preset.name}"?`)) onDelete()
          }}
          className="ml-0.5 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Delete preset ${preset.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
