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

  const promises: Promise<SessionSummary[]>[] = []

  if (tools.find((t) => t.name === 'claude-code')?.available) {
    promises.push(listClaudeCodeSessions())
  }
  if (tools.find((t) => t.name === 'cursor')?.available) {
    promises.push(listCursorSessions())
  }
  if (tools.find((t) => t.name === 'codex')?.available) {
    promises.push(listCodexSessions())
  }
  if (tools.find((t) => t.name === 'proxy')?.available) {
    promises.push(listProxyCaptures())
  }

  const results = await Promise.all(promises)
  for (const sessions of results) {
    allSessions.push(...sessions)
  }

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
