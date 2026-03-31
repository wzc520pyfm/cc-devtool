import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createRequire } from 'module'
import type { Server } from 'http'
import { startProxyServer } from './index.js'
import { getCapturesDir } from './capture.js'

const require = createRequire(import.meta.url)
const CONFIG_DIR = join(homedir(), '.cc-devtool')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const CC_SWITCH_DB_PATH = join(homedir(), '.cc-switch', 'cc-switch.db')

export interface ProxyConfig {
  port: number
  anthropicUpstream: string
  openaiUpstream: string
  autoStart: boolean
  dataSourcePreference: 'all' | 'local' | 'proxy'
}

export interface CcSwitchInfo {
  detected: boolean
  address?: string
  port?: number
  apps?: { appType: string; enabled: boolean }[]
}

export interface ProxyStatus {
  running: boolean
  port: number
  anthropicUpstream: string
  openaiUpstream: string
  autoStart: boolean
  dataSourcePreference: 'all' | 'local' | 'proxy'
  captureCount: number
  capturesDiskBytes: number
  lastCaptureTime: string | null
  ccSwitch: CcSwitchInfo
}

const DEFAULT_CONFIG: ProxyConfig = {
  port: 4174,
  anthropicUpstream: 'https://api.anthropic.com',
  openaiUpstream: 'https://api.openai.com',
  autoStart: false,
  dataSourcePreference: 'all',
}

class ProxyManager {
  private server: Server | null = null
  private config: ProxyConfig

  constructor() {
    this.config = this.loadConfig()
  }

  private loadConfig(): ProxyConfig {
    try {
      if (existsSync(CONFIG_PATH)) {
        const raw = readFileSync(CONFIG_PATH, 'utf-8')
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      }
    } catch { /* use defaults */ }
    return { ...DEFAULT_CONFIG }
  }

  private saveConfig() {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true })
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2))
  }

  getConfig(): ProxyConfig {
    return { ...this.config }
  }

  isRunning(): boolean {
    return this.server !== null
  }

  async start(overrides?: Partial<ProxyConfig>): Promise<void> {
    if (this.server) {
      throw new Error('Proxy is already running')
    }

    if (overrides) {
      Object.assign(this.config, overrides)
      this.saveConfig()
    }

    this.server = await startProxyServer({
      port: this.config.port,
      anthropicUpstream: this.config.anthropicUpstream,
      openaiUpstream: this.config.openaiUpstream,
    })
  }

  async stop(): Promise<void> {
    if (!this.server) {
      throw new Error('Proxy is not running')
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        this.server = null
        if (err) reject(err)
        else resolve()
      })
    })
  }

  updateConfig(partial: Partial<ProxyConfig>): ProxyConfig {
    Object.assign(this.config, partial)
    this.saveConfig()
    return this.getConfig()
  }

  detectCcSwitch(): CcSwitchInfo {
    try {
      if (!existsSync(CC_SWITCH_DB_PATH)) return { detected: false }

      const Database = require('better-sqlite3')
      const db = new Database(CC_SWITCH_DB_PATH, { readonly: true })
      try {
        const rows = db.prepare(
          'SELECT app_type, proxy_enabled, listen_address, listen_port FROM proxy_config',
        ).all() as { app_type: string; proxy_enabled: number; listen_address: string; listen_port: number }[]

        if (rows.length === 0) return { detected: false }

        const first = rows[0]
        return {
          detected: true,
          address: first.listen_address,
          port: first.listen_port,
          apps: rows.map((r) => ({ appType: r.app_type, enabled: r.proxy_enabled === 1 })),
        }
      } finally {
        db.close()
      }
    } catch {
      return { detected: false }
    }
  }

  getStatus(): ProxyStatus {
    const capturesDir = getCapturesDir()
    let captureCount = 0
    let capturesDiskBytes = 0
    let lastCaptureTime: string | null = null
    let latestMtime = 0

    try {
      if (existsSync(capturesDir)) {
        const files = readdirSync(capturesDir).filter((f) => f.endsWith('.jsonl'))
        captureCount = files.length
        for (const file of files) {
          const fp = join(capturesDir, file)
          const st = statSync(fp)
          capturesDiskBytes += st.size
          if (st.mtimeMs > latestMtime) {
            latestMtime = st.mtimeMs
            lastCaptureTime = st.mtime.toISOString()
          }
        }
      }
    } catch { /* ignore */ }

    return {
      running: this.isRunning(),
      port: this.config.port,
      anthropicUpstream: this.config.anthropicUpstream,
      openaiUpstream: this.config.openaiUpstream,
      autoStart: this.config.autoStart,
      dataSourcePreference: this.config.dataSourcePreference,
      captureCount,
      capturesDiskBytes,
      lastCaptureTime,
      ccSwitch: this.detectCcSwitch(),
    }
  }

  async autoStartIfConfigured(): Promise<void> {
    if (this.config.autoStart && !this.server) {
      try {
        await this.start()
      } catch (err) {
        console.error('  Proxy auto-start failed:', err)
      }
    }
  }
}

export const proxyManager = new ProxyManager()
