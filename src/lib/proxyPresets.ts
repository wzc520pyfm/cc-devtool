const STORAGE_KEY = 'cc-devtool:proxy-presets'

export interface ProxyPreset {
  id: string
  name: string
  anthropicUpstream: string
  openaiUpstream: string
  /** Built-ins are not editable / removable. */
  builtin?: 'direct' | 'cc-switch'
}

export const DIRECT_PRESET: ProxyPreset = {
  id: 'builtin:direct',
  name: 'Direct',
  anthropicUpstream: 'https://api.anthropic.com',
  openaiUpstream: 'https://api.openai.com',
  builtin: 'direct',
}

export function ccSwitchPreset(url: string): ProxyPreset {
  return {
    id: 'builtin:cc-switch',
    name: 'cc-switch',
    anthropicUpstream: url,
    openaiUpstream: url,
    builtin: 'cc-switch',
  }
}

export function loadUserPresets(): ProxyPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is ProxyPreset =>
        p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.anthropicUpstream === 'string' &&
        typeof p.openaiUpstream === 'string',
    )
  } catch {
    return []
  }
}

export function saveUserPresets(presets: ProxyPreset[]): void {
  try {
    const userOnly = presets.filter((p) => !p.builtin)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly))
  } catch {
    /* localStorage unavailable */
  }
}

export function presetsEqual(a: ProxyPreset, anthropic: string, openai: string): boolean {
  return a.anthropicUpstream === anthropic && a.openaiUpstream === openai
}

export function makePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
