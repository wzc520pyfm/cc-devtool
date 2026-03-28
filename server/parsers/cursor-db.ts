import { join } from 'path'
import { homedir } from 'os'
import { createRequire } from 'module'
import type { SessionSummary, CodeStats, FileOp } from './types.js'

const require = createRequire(import.meta.url)
const DB_PATH = join(homedir(), '.cursor', 'ai-tracking', 'ai-code-tracking.db')

interface AiCodeRow {
  hash: string
  model: string
  source: string
  fileName: string
  fileExtension: string
  conversationId: string
  timestamp: number
}

interface ScoredCommitRow {
  commitHash: string
  branchName: string
  composerLinesAdded: number
  composerLinesDeleted: number
  linesAdded: number
  linesDeleted: number
  v2AiPercentage: string | null
  commitMessage: string
  commitDate: string
}

let dbInstance: ReturnType<typeof openDb> | null = null

function openDb() {
  try {
    const Database = require('better-sqlite3')
    return new Database(DB_PATH, { readonly: true })
  } catch {
    return null
  }
}

function getDb() {
  if (!dbInstance) dbInstance = openDb()
  return dbInstance
}

export function enrichCursorSummary(summary: SessionSummary): SessionSummary {
  const db = getDb()
  if (!db) return summary

  try {
    const rows = db.prepare(
      'SELECT DISTINCT model, source, fileName FROM ai_code_hashes WHERE conversationId = ?',
    ).all(summary.id) as AiCodeRow[]

    if (rows.length === 0) return summary

    const models = [...new Set(rows.map((r) => r.model).filter(Boolean))]
    const uniqueFiles = new Set(rows.map((r) => r.fileName).filter(Boolean))
    const codeBlocks = rows.length

    const enriched = { ...summary }

    if (models.length > 0 && !enriched.model) {
      enriched.model = models[0]
    }

    enriched.codeStats = {
      codeBlocks,
      uniqueFiles: uniqueFiles.size,
    }

    return enriched
  } catch {
    return summary
  }
}

export function getAiPercentageForProject(projectPath: string): number | null {
  const db = getDb()
  if (!db) return null

  try {
    const rows = db.prepare(
      'SELECT v2AiPercentage FROM scored_commits ORDER BY scoredAt DESC LIMIT 10',
    ).all() as ScoredCommitRow[]

    if (rows.length === 0) return null

    const percentages = rows
      .map((r) => parseFloat(r.v2AiPercentage ?? '0'))
      .filter((p) => !isNaN(p))

    if (percentages.length === 0) return null
    return percentages.reduce((a, b) => a + b, 0) / percentages.length
  } catch {
    return null
  }
}

export interface CursorDbFileOp {
  fileName: string
  model: string
  source: string
  timestamp: number
}

export function getFileOpsForConversation(conversationId: string): CursorDbFileOp[] {
  const db = getDb()
  if (!db) return []

  try {
    const rows = db.prepare(
      'SELECT fileName, model, source, timestamp FROM ai_code_hashes WHERE conversationId = ? ORDER BY timestamp',
    ).all(conversationId) as CursorDbFileOp[]
    return rows
  } catch {
    return []
  }
}

export function getModelForConversation(conversationId: string): string | undefined {
  const db = getDb()
  if (!db) return undefined

  try {
    const row = db.prepare(
      'SELECT model FROM ai_code_hashes WHERE conversationId = ? AND model IS NOT NULL LIMIT 1',
    ).get(conversationId) as { model: string } | undefined
    return row?.model
  } catch {
    return undefined
  }
}

export function closeDb() {
  if (dbInstance) {
    try { dbInstance.close() } catch { /* */ }
    dbInstance = null
  }
}
