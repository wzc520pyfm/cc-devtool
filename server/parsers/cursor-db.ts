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
  const [one] = enrichCursorSummariesBatch([summary])
  return one
}

/** One SQLite round-trip per chunk instead of one query per session (major win for large local lists). */
export function enrichCursorSummariesBatch(summaries: SessionSummary[]): SessionSummary[] {
  const db = getDb()
  if (!db) return summaries

  const cursorIds: string[] = []
  const idSet = new Set<string>()
  for (const s of summaries) {
    if (s.tool === 'cursor' && !idSet.has(s.id)) {
      idSet.add(s.id)
      cursorIds.push(s.id)
    }
  }
  if (cursorIds.length === 0) return summaries

  const agg = new Map<
    string,
    { models: Set<string>; files: Set<string>; codeBlocks: number }
  >()

  const CHUNK = 400
  try {
    for (let i = 0; i < cursorIds.length; i += CHUNK) {
      const chunk = cursorIds.slice(i, i + CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      const rows = db
        .prepare(
          `SELECT DISTINCT conversationId, model, source, fileName FROM ai_code_hashes WHERE conversationId IN (${placeholders})`,
        )
        .all(...chunk) as (AiCodeRow & { conversationId: string })[]

      for (const row of rows) {
        const cid = row.conversationId
        let a = agg.get(cid)
        if (!a) {
          a = { models: new Set(), files: new Set(), codeBlocks: 0 }
          agg.set(cid, a)
        }
        a.codeBlocks++
        if (row.model) a.models.add(row.model)
        if (row.fileName) a.files.add(row.fileName)
      }
    }
  } catch {
    return summaries
  }

  return summaries.map((s) => {
    if (s.tool !== 'cursor') return s
    const data = agg.get(s.id)
    if (!data || data.codeBlocks === 0) return s

    const enriched = { ...s }
    const firstModel = [...data.models][0]
    if (firstModel && !enriched.model) {
      enriched.model = firstModel
    }
    enriched.codeStats = {
      codeBlocks: data.codeBlocks,
      uniqueFiles: data.files.size,
    }
    return enriched
  })
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
