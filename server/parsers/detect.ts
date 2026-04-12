import { stat } from 'fs/promises'
import { getClaudeBaseDir, listClaudeCodeSessions } from './claude-code.js'
import { getCursorBaseDir, listCursorSessions } from './cursor.js'
import { getCodexBaseDir, listCodexSessions } from './codex.js'
import { getCapturesBaseDir, listProxyCaptures } from './proxy-capture.js'
import type { SessionSummary, ToolSource } from './types.js'

interface DetectedTool {
  name: ToolSource | 'proxy'
  label: string
  baseDir: string
  available: boolean
}

export async function detectTools(): Promise<DetectedTool[]> {
  const tools: DetectedTool[] = [
    { name: 'claude-code', label: 'Claude Code', baseDir: getClaudeBaseDir(), available: false },
    { name: 'cursor', label: 'Cursor', baseDir: getCursorBaseDir(), available: false },
    { name: 'codex', label: 'Codex', baseDir: getCodexBaseDir(), available: false },
    { name: 'proxy', label: 'Proxy Captures', baseDir: getCapturesBaseDir(), available: false },
  ]

  for (const tool of tools) {
    try {
      const st = await stat(tool.baseDir)
      tool.available = st.isDirectory()
    } catch {
      tool.available = false
    }
  }

  return tools
}

export async function listAllSessions(): Promise<SessionSummary[]> {
  const tools = await detectTools()
  const allSessions: SessionSummary[] = []

  const jobs: { name: string; run: () => Promise<SessionSummary[]> }[] = []

  if (tools.find((t) => t.name === 'claude-code')?.available) {
    jobs.push({ name: 'claude-code', run: listClaudeCodeSessions })
  }
  if (tools.find((t) => t.name === 'cursor')?.available) {
    jobs.push({ name: 'cursor', run: listCursorSessions })
  }
  if (tools.find((t) => t.name === 'codex')?.available) {
    jobs.push({ name: 'codex', run: listCodexSessions })
  }
  if (tools.find((t) => t.name === 'proxy')?.available) {
    jobs.push({ name: 'proxy', run: listProxyCaptures })
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.run()))
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      allSessions.push(...result.value)
    } else {
      console.error(`Session list failed for ${jobs[i].name}:`, result.reason)
    }
  })

  for (const s of allSessions) {
    if (!s.dataSource) s.dataSource = 'local'
  }

  allSessions.sort((a, b) => {
    const ta = new Date(a.startTime).getTime()
    const tb = new Date(b.startTime).getTime()
    return tb - ta
  })

  return allSessions
}
