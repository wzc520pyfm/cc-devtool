import { readdir, stat } from 'fs/promises'
import { join, basename, dirname } from 'path'
import { homedir } from 'os'
import { readJsonlFile, extractUserQuery, genId, safeTimestamp } from './utils.js'
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
  DataAvailability,
} from './types.js'

const CLAUDE_DIR = join(homedir(), '.claude')

export function getClaudeBaseDir(): string {
  return CLAUDE_DIR
}

interface ClaudeHistoryEntry {
  display: string
  timestamp: number
  project: string
  sessionId: string
}

interface ClaudeRecord {
  parentUuid?: string | null
  uuid?: string
  type?: string
  subtype?: string
  timestamp?: string
  sessionId?: string
  cwd?: string
  version?: string
  gitBranch?: string
  message?: {
    role?: string
    content?: string | ClaudeContentBlock[]
    usage?: ClaudeUsage
    model?: string
  }
  error?: string
  promptId?: string
  toolUseResult?: {
    agentId?: string
    usage?: ClaudeUsage
    prompt?: string
    content?: ClaudeContentBlock[]
  }
  snapshot?: unknown
  messageId?: string
  lastPrompt?: string
  isSidechain?: boolean
}

interface ClaudeContentBlock {
  type: string
  text?: string
  thinking?: string
  name?: string
  input?: Record<string, unknown>
  id?: string
  content?: ClaudeContentBlock[] | string
}

interface ClaudeUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export async function listClaudeCodeSessions(): Promise<SessionSummary[]> {
  const projectsDir = join(CLAUDE_DIR, 'projects')
  const summaries: SessionSummary[] = []

  try {
    const projectDirs = await readdir(projectsDir)
    for (const projDir of projectDirs) {
      const projPath = join(projectsDir, projDir)
      const st = await stat(projPath).catch(() => null)
      if (!st?.isDirectory()) continue

      const files = await readdir(projPath).catch(() => [] as string[])
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue
        const filePath = join(projPath, file)
        const sessionId = basename(file, '.jsonl')
        const project = decodeClaudePath(projDir)

        try {
          const records = (await readJsonlFile(filePath)) as ClaudeRecord[]
          const summary = buildClaudeSessionSummary(
            sessionId,
            project,
            filePath,
            records,
          )
          if (summary) summaries.push(summary)
        } catch { /* skip */ }
      }
    }
  } catch { /* claude dir may not exist */ }

  return summaries
}

function decodeClaudePath(encoded: string): string {
  return encoded
    .replace(/^-/, '/')
    .replace(/---/g, '·TRIPLE·')
    .replace(/-/g, '/')
    .replace(/·TRIPLE·/g, '/')
}

function buildClaudeSessionSummary(
  sessionId: string,
  project: string,
  filePath: string,
  records: ClaudeRecord[],
): SessionSummary | null {
  const userMsgs = records.filter((r) => r.type === 'user')
  if (userMsgs.length === 0) return null

  const firstUser = userMsgs[0]
  const content = firstUser?.message?.content
  let title = ''
  if (typeof content === 'string') {
    title = extractUserQuery(content) || content.slice(0, 100)
  } else if (Array.isArray(content)) {
    const textBlock = content.find((b) => b.type === 'text')
    title = textBlock?.text?.slice(0, 100) ?? sessionId
  }

  const timestamps = records
    .filter((r) => r.timestamp)
    .map((r) => r.timestamp!)
  const startTime = timestamps[0] ?? new Date().toISOString()
  const endTime = timestamps[timestamps.length - 1]

  let totalTokens = emptyTokenUsage()
  let toolCallCount = 0
  const filePathsSet = new Set<string>()

  for (const rec of records) {
    if (rec.type === 'assistant' && rec.message?.usage) {
      totalTokens = addTokenUsage(totalTokens, parseClaudeUsage(rec.message.usage))
    }
    if (rec.type === 'assistant' && Array.isArray(rec.message?.content)) {
      for (const block of rec.message.content) {
        if (block.type === 'tool_use') {
          toolCallCount++
          const filePath = (block.input as Record<string, unknown>)?.file_path ??
            (block.input as Record<string, unknown>)?.path
          if (typeof filePath === 'string') filePathsSet.add(filePath)
        }
      }
    }
  }

  const agentResults = records.filter(
    (r) => r.type === 'user' && r.toolUseResult?.agentId,
  )

  const lastRec = records[records.length - 1]
  const recentMs = Date.now() - new Date(endTime ?? startTime).getTime()
  const status = recentMs < 120_000 ? 'active' as const : 'completed' as const

  return {
    id: sessionId,
    tool: 'claude-code',
    project,
    title,
    startTime,
    endTime,
    status,
    model: findModel(records),
    turnCount: userMsgs.length + records.filter((r) => r.type === 'assistant').length,
    toolCallCount,
    fileOpCount: filePathsSet.size,
    agentCount: 1 + agentResults.length,
    tokenUsage: totalTokens,
    filePath,
    hasToolData: toolCallCount > 0 || totalTokens.totalTokens > 0,
    dataAvailability: {
      toolCalls: toolCallCount > 0 ? 'full' : 'none',
      tokenUsage: totalTokens.totalTokens > 0 ? 'full' : 'none',
      fileOps: toolCallCount > 0 ? 'full' : 'none',
      reason: toolCallCount === 0 && totalTokens.totalTokens > 0
        ? 'Chat-only session (no tool usage)'
        : toolCallCount === 0
          ? 'No coding activity in this session'
          : undefined,
    },
  }
}

function findModel(records: ClaudeRecord[]): string | undefined {
  for (const rec of records) {
    if (rec.type === 'assistant' && rec.message?.model && rec.message.model !== '<synthetic>') {
      return rec.message.model
    }
  }
  return undefined
}

export async function parseClaudeCodeSession(filePath: string): Promise<Session> {
  const records = (await readJsonlFile(filePath)) as ClaudeRecord[]
  const sessionId = basename(filePath, '.jsonl')
  const projectDir = basename(dirname(filePath))
  const project = decodeClaudePath(projectDir)

  const turns: Turn[] = []
  const fileOps: FileOp[] = []
  const skillHits: SkillHit[] = []
  const mcpCalls: McpCall[] = []
  const ruleRefs: RuleRef[] = []
  const agentMap = new Map<string, AgentNode>()
  let totalUsage = emptyTokenUsage()
  let title = ''

  const mainAgent: AgentNode = {
    id: 'main',
    name: 'Main Agent',
    status: 'completed',
    tokenUsage: emptyTokenUsage(),
    toolCallCount: 0,
    turnCount: 0,
  }
  agentMap.set('main', mainAgent)

  for (const rec of records) {
    if (rec.type === 'file-history-snapshot' || rec.type === 'last-prompt') continue

    if (rec.type === 'user' && rec.message) {
      const content = rec.message.content
      let textContent = ''
      if (typeof content === 'string') {
        textContent = content
      } else if (Array.isArray(content)) {
        textContent = content
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('\n')
      }

      if (!title && textContent) {
        title = extractUserQuery(textContent) || textContent.slice(0, 100)
      }

      if (rec.toolUseResult) {
        const agentId = rec.toolUseResult.agentId ?? genId()
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            id: agentId,
            parentId: 'main',
            name: `Subagent ${agentId.slice(0, 8)}`,
            description: rec.toolUseResult.prompt?.slice(0, 200),
            status: 'completed',
            tokenUsage: parseClaudeUsage(rec.toolUseResult.usage ?? {}),
            toolCallCount: 0,
            turnCount: 0,
          })
        }
        continue
      }

      const turn: Turn = {
        id: rec.uuid ?? genId(),
        agentId: 'main',
        role: 'user',
        blocks: [{ type: 'text', text: textContent }],
        timestamp: safeTimestamp(rec.timestamp),
      }
      turns.push(turn)
      mainAgent.turnCount++
    }

    if (rec.type === 'assistant' && rec.message) {
      const usage = rec.message.usage
        ? parseClaudeUsage(rec.message.usage)
        : undefined
      if (usage) {
        totalUsage = addTokenUsage(totalUsage, usage)
        mainAgent.tokenUsage = addTokenUsage(mainAgent.tokenUsage, usage)
      }

      const blocks: ContentBlock[] = []
      const content = rec.message.content
      if (typeof content === 'string') {
        blocks.push({ type: 'text', text: content })
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            blocks.push({ type: 'text', text: block.text ?? '' })
          } else if (block.type === 'thinking') {
            blocks.push({ type: 'thinking', thinking: block.thinking ?? '' })
          } else if (block.type === 'tool_use') {
            const toolName = block.name ?? 'unknown'
            const input = (block.input ?? {}) as Record<string, unknown>
            const tc: ToolCall = {
              id: block.id ?? genId(),
              name: toolName,
              category: categorizeToolCall(toolName),
              input,
              timestamp: safeTimestamp(rec.timestamp),
            }
            blocks.push({ type: 'tool_use', toolCall: tc })
            mainAgent.toolCallCount++

            processToolCall(tc, 'main', rec.timestamp, fileOps, skillHits, mcpCalls, ruleRefs)
          }
        }
      }

      const turn: Turn = {
        id: rec.uuid ?? genId(),
        agentId: 'main',
        role: 'assistant',
        blocks,
        timestamp: safeTimestamp(rec.timestamp),
        tokenUsage: usage,
      }
      turns.push(turn)
      mainAgent.turnCount++
    }

    if (rec.type === 'system') {
      turns.push({
        id: rec.uuid ?? genId(),
        agentId: 'main',
        role: 'system',
        blocks: [{ type: 'text', text: rec.content as string ?? '' }],
        timestamp: safeTimestamp(rec.timestamp),
      })
    }
  }

  const timestamps = turns.map((t) => t.timestamp).filter(Boolean)
  const startTime = timestamps[0] ?? new Date().toISOString()
  const endTime = timestamps[timestamps.length - 1]

  return {
    id: sessionId,
    tool: 'claude-code',
    project,
    title,
    startTime,
    endTime,
    status: 'completed',
    model: findModel(records),
    turns,
    agents: Array.from(agentMap.values()),
    fileOps,
    tokenUsage: totalUsage,
    skillHits,
    mcpCalls,
    ruleRefs,
  }
}

function isSkillPath(path: string): boolean {
  return /SKILL\.md$/i.test(path) || /\/skills\//.test(path)
}

function isRulePath(path: string): boolean {
  return (
    /\.cursor\/rules\//.test(path) ||
    /\.cursorrules$/i.test(path) ||
    /CLAUDE\.md$/i.test(path) ||
    /AGENTS\.md$/i.test(path) ||
    /\.claude\/settings/i.test(path) ||
    /rules\/.*\.mdc?$/i.test(path)
  )
}

function processToolCall(
  tc: ToolCall,
  agentId: string,
  timestamp: unknown,
  fileOps: FileOp[],
  skillHits: SkillHit[],
  mcpCalls: McpCall[],
  ruleRefs: RuleRef[],
) {
  const ts = safeTimestamp(timestamp)
  const path = (tc.input.file_path ?? tc.input.path) as string | undefined

  if (tc.category === 'file_read' && path) {
    fileOps.push({ path, type: 'read', agentId, timestamp: ts, toolCallId: tc.id })
    if (isSkillPath(path)) {
      const name = path.split('/').slice(-2).join('/')
      skillHits.push({ name, fullPath: path, agentId, timestamp: ts, toolCallId: tc.id })
    } else if (isRulePath(path)) {
      ruleRefs.push({ path, agentId, timestamp: ts })
    }
  }

  if (tc.name === 'Write' && path) {
    fileOps.push({ path, type: 'create', agentId, timestamp: ts, toolCallId: tc.id })
  }

  if (tc.name === 'Delete' && path) {
    fileOps.push({ path, type: 'delete', agentId, timestamp: ts, toolCallId: tc.id })
  }

  if ((tc.name === 'StrReplace' || tc.name === 'EditNotebook') && path) {
    fileOps.push({ path, type: 'update', agentId, timestamp: ts, toolCallId: tc.id })
  }

  if (tc.name === 'Skill') {
    const skillName = tc.input.skill as string | undefined
    if (skillName) {
      skillHits.push({
        name: skillName,
        fullPath: tc.input.file_path as string | undefined,
        agentId,
        timestamp: ts,
        toolCallId: tc.id,
      })
    }
  }

  if (tc.name === 'call_mcp_tool' || tc.name === 'CallMcpTool') {
    mcpCalls.push({
      server: (tc.input.server ?? '') as string,
      toolName: (tc.input.toolName ?? tc.input.tool_name ?? '') as string,
      arguments: tc.input.arguments as Record<string, unknown> | undefined,
      agentId,
      timestamp: ts,
      toolCallId: tc.id,
    })
  }
}

function parseClaudeUsage(usage: ClaudeUsage): TokenUsage {
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheCreate = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  return {
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: cacheCreate,
    cacheReadTokens: cacheRead,
    totalTokens: input + output + cacheCreate + cacheRead,
  }
}
