import { Router } from 'express'
import { readFile, stat } from 'fs/promises'
import { listAllSessions, detectTools } from '../parsers/detect.js'
import { parseClaudeCodeSession } from '../parsers/claude-code.js'
import { parseCursorSession } from '../parsers/cursor.js'
import { parseCodexSession } from '../parsers/codex.js'
import type { SessionSummary } from '../parsers/types.js'

export const sessionsRouter = Router()

let cachedSessions: SessionSummary[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 10_000

sessionsRouter.get('/sessions', async (_req, res) => {
  try {
    const now = Date.now()
    if (!cachedSessions || now - cacheTimestamp > CACHE_TTL) {
      cachedSessions = await listAllSessions()
      cacheTimestamp = now
    }
    res.json(cachedSessions)
  } catch (err) {
    console.error('Error listing sessions:', err)
    res.status(500).json({ error: 'Failed to list sessions' })
  }
})

sessionsRouter.get('/sessions/:tool/:id', async (req, res) => {
  try {
    const { tool, id } = req.params
    const sessions = cachedSessions ?? (await listAllSessions())
    const session = sessions.find(
      (s) => s.tool === tool && s.id === id,
    )

    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    let detail
    switch (tool) {
      case 'claude-code':
        detail = await parseClaudeCodeSession(session.filePath)
        break
      case 'cursor':
        detail = await parseCursorSession(session.filePath)
        break
      case 'codex':
        detail = await parseCodexSession(session.filePath)
        break
      default:
        res.status(400).json({ error: 'Unknown tool' })
        return
    }

    res.json(detail)
  } catch (err) {
    console.error('Error parsing session:', err)
    res.status(500).json({ error: 'Failed to parse session' })
  }
})

sessionsRouter.get('/sessions/:tool/:id/raw', async (req, res) => {
  try {
    const { tool, id } = req.params
    const sessions = cachedSessions ?? (await listAllSessions())
    const session = sessions.find(
      (s) => s.tool === tool && s.id === id,
    )

    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const filePath = session.filePath
    const fileStat = await stat(filePath).catch(() => null)
    if (!fileStat) {
      res.status(404).json({ error: 'Raw file not found' })
      return
    }

    const content = await readFile(filePath, 'utf-8')
    const format = filePath.endsWith('.txt') ? 'txt' : 'jsonl'

    res.json({
      content,
      filePath,
      format,
      size: fileStat.size,
    })
  } catch (err) {
    console.error('Error reading raw file:', err)
    res.status(500).json({ error: 'Failed to read raw file' })
  }
})

sessionsRouter.get('/tools', async (_req, res) => {
  try {
    const tools = await detectTools()
    res.json(tools)
  } catch (err) {
    res.status(500).json({ error: 'Failed to detect tools' })
  }
})

export function invalidateCache() {
  cachedSessions = null
  cacheTimestamp = 0
}
