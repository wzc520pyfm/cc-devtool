import { readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { readJsonlFile, genId, safeTimestamp } from './utils.js'
import {
  emptyTokenUsage,
  addTokenUsage,
  categorizeToolCall,
} from './types.js'
import type {
  Session,
  SessionSummary,
  Turn,
  ContentBlock,
  ToolCall,
  FileOp,
  AgentNode,
  SkillHit,
  McpCall,
  RuleRef,
  TokenUsage,
} from './types.js'

const CODEX_DIR = join(homedir(), '.codex')

export function getCodexBaseDir(): string {
  return CODEX_DIR
}

interface CodexRecord {
  timestamp?: string
  type?: string
  payload?: CodexPayload
}

interface CodexPayload {
  id?: string
  cwd?: string
  model_provider?: string
  model?: string
  type?: string
  role?: string
  content?: CodexContentBlock[]
  name?: string
  arguments?: string
  call_id?: string
  output?: string
  summary?: unknown[]
  encrypted_content?: string
  turn_id?: string
  message?: string
  phase?: string
  info?: {
    total_token_usage?: CodexTokenUsage
    last_token_usage?: CodexTokenUsage
  }
  base_instructions?: { text?: string }
  collaboration_mode?: { settings?: { model?: string } }
  sandbox_policy?: unknown
}

interface CodexContentBlock {
  type: string
  text?: string
  input_text?: string
  output_text?: string
}

interface CodexTokenUsage {
  input_tokens?: number
  output_tokens?: number
  reasoning_output_tokens?: number
  cached_input_tokens?: number
  total_tokens?: number
}

interface CodexIndexEntry {
  id: string
  thread_name: string
  updated_at: string
}

export async function listCodexSessions(): Promise<SessionSummary[]> {
  const summaries: SessionSummary[] = []
  const indexPath = join(CODEX_DIR, 'session_index.jsonl')

  try {
    const indexEntries = (await readJsonlFile(indexPath)) as CodexIndexEntry[]
    const sessionsDir = join(CODEX_DIR, 'sessions')

    for (const entry of indexEntries) {
      const sessionFile = await findCodexSessionFile(sessionsDir, entry.id)
      if (!sessionFile) continue

      try {
        const records = (await readJsonlFile(sessionFile)) as CodexRecord[]
        const summary = buildCodexSummary(entry, sessionFile, records)
        if (summary) summaries.push(summary)
      } catch { /* skip */ }
    }
  } catch { /* codex dir may not exist */ }

  return summaries
}

async function findCodexSessionFile(sessionsDir: string, threadId: string): Promise<string | null> {
  try {
    const years = await readdir(sessionsDir)
    for (const year of years) {
      const yearDir = join(sessionsDir, year)
      const months = await readdir(yearDir).catch(() => [] as string[])
      for (const month of months) {
        const monthDir = join(yearDir, month)
        const days = await readdir(monthDir).catch(() => [] as string[])
        for (const day of days) {
          const dayDir = join(monthDir, day)
          const files = await readdir(dayDir).catch(() => [] as string[])
          for (const file of files) {
            if (file.includes(threadId) && file.endsWith('.jsonl')) {
              return join(dayDir, file)
            }
          }
        }
      }
    }
  } catch { /* */ }
  return null
}

function buildCodexSummary(
  entry: CodexIndexEntry,
  filePath: string,
  records: CodexRecord[],
): SessionSummary | null {
  const meta = records.find((r) => r.type === 'session_meta')
  const project = meta?.payload?.cwd ?? ''
  const model = meta?.payload?.collaboration_mode?.settings?.model ?? meta?.payload?.model_provider

  let totalUsage = emptyTokenUsage()
  let toolCallCount = 0

  for (const rec of records) {
    if (rec.type === 'event_msg' && rec.payload?.type === 'token_count') {
      const usage = rec.payload.info?.total_token_usage
      if (usage) {
        totalUsage = {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheCreationTokens: 0,
          cacheReadTokens: usage.cached_input_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        }
      }
    }
    if (rec.type === 'response_item' && rec.payload?.type === 'function_call') {
      toolCallCount++
    }
  }

  const userMessages = records.filter(
    (r) => r.type === 'response_item' && r.payload?.role === 'user',
  )
  const assistantMessages = records.filter(
    (r) =>
      (r.type === 'response_item' && r.payload?.role === 'assistant') ||
      (r.type === 'event_msg' && r.payload?.type === 'agent_message'),
  )

  const startTime = meta?.timestamp ?? records[0]?.timestamp ?? new Date().toISOString()
  const lastRec = records[records.length - 1]
  const endTime = lastRec?.timestamp

  return {
    id: entry.id,
    tool: 'codex',
    project,
    title: entry.thread_name || entry.id,
    startTime: safeTimestamp(startTime),
    endTime: endTime ? safeTimestamp(endTime) : undefined,
    status: 'completed',
    model,
    turnCount: userMessages.length + assistantMessages.length,
    toolCallCount,
    fileOpCount: 0,
    agentCount: 1,
    tokenUsage: totalUsage,
    filePath,
  }
}

export async function parseCodexSession(filePath: string): Promise<Session> {
  const records = (await readJsonlFile(filePath)) as CodexRecord[]
  const meta = records.find((r) => r.type === 'session_meta')

  const sessionId = meta?.payload?.id ?? basename(filePath, '.jsonl')
  const project = meta?.payload?.cwd ?? ''
  const model = meta?.payload?.collaboration_mode?.settings?.model ?? meta?.payload?.model_provider

  const turns: Turn[] = []
  const fileOps: FileOp[] = []
  const skillHits: SkillHit[] = []
  const mcpCalls: McpCall[] = []
  const ruleRefs: RuleRef[] = []
  let totalUsage = emptyTokenUsage()
  let title = ''

  for (const rec of records) {
    const ts = safeTimestamp(rec.timestamp)

    if (rec.type === 'response_item') {
      const payload = rec.payload
      if (!payload) continue

      if (payload.role === 'user') {
        const text = payload.content
          ?.filter((b) => b.type === 'input_text')
          .map((b) => b.text ?? '')
          .join('\n') ?? ''

        if (!title && text && !text.startsWith('<')) {
          title = text.slice(0, 100)
        }

        turns.push({
          id: genId(),
          agentId: 'main',
          role: 'user',
          blocks: [{ type: 'text', text }],
          timestamp: ts,
        })
      }

      if (payload.role === 'assistant') {
        const text = payload.content
          ?.filter((b) => b.type === 'output_text')
          .map((b) => b.text ?? '')
          .join('\n') ?? ''

        if (text) {
          turns.push({
            id: genId(),
            agentId: 'main',
            role: 'assistant',
            blocks: [{ type: 'text', text }],
            timestamp: ts,
          })
        }
      }

      if (payload.type === 'function_call') {
        const funcName = payload.name ?? 'unknown'
        let input: Record<string, unknown> = {}
        try {
          input = JSON.parse(payload.arguments ?? '{}')
        } catch { /* */ }

        const tc: ToolCall = {
          id: payload.call_id ?? genId(),
          name: funcName,
          category: categorizeToolCall(funcName),
          input,
          timestamp: ts,
        }
        turns.push({
          id: genId(),
          agentId: 'main',
          role: 'assistant',
          blocks: [{ type: 'tool_use', toolCall: tc }],
          timestamp: ts,
        })

        if (funcName === 'exec_command' || funcName === 'shell') {
          const cmd = (input.cmd ?? input.command ?? '') as string
          if (cmd.includes('cat ') || cmd.includes('sed ')) {
            const pathMatch = cmd.match(/'([^']+)'/)
            if (pathMatch) {
              fileOps.push({
                path: pathMatch[1],
                type: cmd.includes('sed ') ? 'update' : 'read',
                agentId: 'main',
                timestamp: ts,
                toolCallId: tc.id,
              })
            }
          }
        }

        if (funcName === 'apply_patch') {
          const patchPath = (input.path ?? '') as string
          if (patchPath) {
            fileOps.push({
              path: patchPath,
              type: 'update',
              agentId: 'main',
              timestamp: ts,
              toolCallId: tc.id,
            })
          }
        }
      }

      if (payload.type === 'function_call_output') {
        const lastToolTurn = [...turns].reverse().find(
          (t) => t.blocks.some((b) => b.type === 'tool_use'),
        )
        if (lastToolTurn) {
          const toolBlock = lastToolTurn.blocks.find((b) => b.type === 'tool_use')
          if (toolBlock && toolBlock.type === 'tool_use') {
            toolBlock.toolCall.result = (payload.output ?? '').slice(0, 2000)
          }
        }
      }

      if (payload.type === 'reasoning') {
        turns.push({
          id: genId(),
          agentId: 'main',
          role: 'assistant',
          blocks: [{ type: 'thinking', thinking: payload.encrypted_content ? '[Encrypted reasoning]' : '' }],
          timestamp: ts,
        })
      }
    }

    if (rec.type === 'event_msg') {
      if (rec.payload?.type === 'token_count') {
        const usage = rec.payload.info?.total_token_usage
        if (usage) {
          totalUsage = {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            cacheCreationTokens: 0,
            cacheReadTokens: usage.cached_input_tokens ?? 0,
            totalTokens: usage.total_tokens ?? 0,
          }
        }
      }

      if (rec.payload?.type === 'agent_message' && rec.payload.message) {
        turns.push({
          id: genId(),
          agentId: 'main',
          role: 'assistant',
          blocks: [{ type: 'text', text: rec.payload.message }],
          timestamp: ts,
        })
        if (!title) title = rec.payload.message.slice(0, 100)
      }
    }
  }

  const timestamps = records.map((r) => r.timestamp).filter(Boolean) as string[]

  return {
    id: sessionId,
    tool: 'codex',
    project,
    title: title || sessionId,
    startTime: timestamps[0] ?? new Date().toISOString(),
    endTime: timestamps[timestamps.length - 1],
    status: 'completed',
    model,
    turns,
    agents: [{
      id: 'main',
      name: 'Main Agent',
      status: 'completed',
      tokenUsage: totalUsage,
      toolCallCount: turns.filter((t) => t.blocks.some((b) => b.type === 'tool_use')).length,
      turnCount: turns.length,
    }],
    fileOps,
    tokenUsage: totalUsage,
    skillHits,
    mcpCalls,
    ruleRefs,
  }
}
