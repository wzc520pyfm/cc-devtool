import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Server } from 'http'
import { startProxyServer } from './index.js'
import { getCapturesDir } from './capture.js'

const CONFIG_DIR = join(homedir(), '.cc-devtool')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

export interface ProxyConfig {
  port: number
  anthropicUpstream: string
  openaiUpstream: string
  autoStart: boolean
  dataSourcePreference: 'all' | 'local' | 'proxy'
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
