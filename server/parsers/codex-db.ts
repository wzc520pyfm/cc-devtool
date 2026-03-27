import { join } from 'path'
import { homedir } from 'os'
import { createRequire } from 'module'
import type { SessionSummary, GitContext, TokenUsage } from './types.js'
import { emptyTokenUsage } from './types.js'

const require = createRequire(import.meta.url)
const STATE_DB_PATH = join(homedir(), '.codex', 'state_5.sqlite')

interface ThreadRow {
  id: string
  cwd: string | null
  title: string | null
  model_provider: string | null
  tokens_used: number | null
  git_sha: string | null
  git_branch: string | null
  git_origin_url: string | null
  cli_version: string | null
  first_user_message: string | null
  sandbox_policy: string | null
  approval_mode: string | null
  created_at: number | null
  updated_at: number | null
}

let dbInstance: ReturnType<typeof openDb> | null = null

function openDb() {
  try {
    const Database = require('better-sqlite3')
    return new Database(STATE_DB_PATH, { readonly: true })
  } catch {
    return null
  }
}

function getDb() {
  if (!dbInstance) dbInstance = openDb()
  return dbInstance
}

export function enrichCodexSummary(summary: SessionSummary): SessionSummary {
  const db = getDb()
  if (!db) return summary

  try {
    const row = db.prepare('SELECT * FROM threads WHERE id = ?').get(summary.id) as ThreadRow | undefined
    if (!row) return summary

    const enriched = { ...summary }

    if (row.tokens_used && row.tokens_used > 0) {
      if (enriched.tokenUsage.totalTokens === 0) {
        enriched.tokenUsage = {
          ...emptyTokenUsage(),
          totalTokens: row.tokens_used,
        }
      }

      if (enriched.dataAvailability) {
        enriched.dataAvailability = {
          ...enriched.dataAvailability,
          tokenUsage: 'full',
        }
      }
    }

    if (row.git_branch || row.git_sha || row.git_origin_url) {
      enriched.gitContext = {
        branch: row.git_branch ?? undefined,
        sha: row.git_sha ?? undefined,
        originUrl: row.git_origin_url ?? undefined,
      }
    }

    if (row.title && (!enriched.title || enriched.title === enriched.id)) {
      enriched.title = row.title
    }

    if (row.cwd && !enriched.project) {
      enriched.project = row.cwd
    }

    if (row.model_provider && !enriched.model) {
      enriched.model = row.model_provider
    }

    return enriched
  } catch {
    return summary
  }
}

export function closeDb() {
  if (dbInstance) {
    try { dbInstance.close() } catch { /* */ }
    dbInstance = null
  }
}
