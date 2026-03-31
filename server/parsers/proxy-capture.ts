import { readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { readJsonlFile, genId, safeTimestamp } from './utils.js'
import { emptyTokenUsage, categorizeToolCall } from './types.js'
import type {
  SessionSummary,
  Session,
  Turn,
  ContentBlock,
  ToolCall,
  FileOp,
  SkillHit,
  McpCall,
  RuleRef,
  TokenUsage,
  ToolSource,
} from './types.js'

const CAPTURES_DIR = join(homedir(), '.cc-devtool', 'captures')

export function getCapturesBaseDir(): string {
  return CAPTURES_DIR
}

interface CaptureUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  total_tokens?: number
}

interface CaptureRecord {
  timestamp: string
  captureId: string
  type: 'request' | 'stream_event' | 'response_complete' | 'error' | 'content_block'
  provider?: 'anthropic' | 'openai'
  model?: string
  stream?: boolean
  messagesCount?: number
  toolsCount?: number
  maxTokens?: number
  lastUserMessage?: string
  eventType?: string
  usage?: CaptureUsage
  stopReason?: string
  contentTypes?: string[]
  error?: string
  statusCode?: number
  blockType?: string
  toolName?: string
  toolId?: string
  toolInput?: Record<string, unknown>
  text?: string
  thinking?: string
  outputItems?: number
  index?: number
}

function parseUsage(usage: CaptureUsage | undefined): TokenUsage {
  if (!usage) return emptyTokenUsage()
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheCreate = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  return {
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: cacheCreate,
    cacheReadTokens: cacheRead,
    totalTokens: usage.total_tokens ?? (input + output + cacheCreate + cacheRead),
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

function processProxyToolCall(
  tc: ToolCall,
  ts: string,
  fileOps: FileOp[],
  skillHits: SkillHit[],
  mcpCalls: McpCall[],
  ruleRefs: RuleRef[],
) {
  const path = (tc.input.file_path ?? tc.input.path) as string | undefined

  if (tc.category === 'file_read' && path) {
    fileOps.push({ path, type: 'read', agentId: 'main', timestamp: ts, toolCallId: tc.id })
    if (isSkillPath(path)) {
      const name = path.split('/').slice(-2).join('/')
      skillHits.push({ name, fullPath: path, agentId: 'main', timestamp: ts, toolCallId: tc.id })
    } else if (isRulePath(path)) {
      ruleRefs.push({ path, agentId: 'main', timestamp: ts })
    }
  }

  if (tc.name === 'Write' || tc.name === 'write_file') {
    if (path) fileOps.push({ path, type: 'create', agentId: 'main', timestamp: ts, toolCallId: tc.id })
  }
  if (tc.name === 'Delete') {
    if (path) fileOps.push({ path, type: 'delete', agentId: 'main', timestamp: ts, toolCallId: tc.id })
  }
  if (tc.name === 'StrReplace' || tc.name === 'EditNotebook' || tc.name === 'apply_patch') {
    if (path) fileOps.push({ path, type: 'update', agentId: 'main', timestamp: ts, toolCallId: tc.id })
  }

  if (tc.name === 'Shell' || tc.name === 'exec_command') {
    const cmd = (tc.input.cmd ?? tc.input.command ?? '') as string
    const sedRead = cmd.match(/sed\s+-n\s+'[^']+'\s+(\/\S+)/)
    const catMatch = cmd.match(/\bcat\s+['"]?([^\s'"]+)/)
    if (sedRead) {
      fileOps.push({ path: sedRead[1], type: 'read', agentId: 'main', timestamp: ts, toolCallId: tc.id })
    } else if (catMatch) {
      fileOps.push({ path: catMatch[1], type: 'read', agentId: 'main', timestamp: ts, toolCallId: tc.id })
    }
  }

  if (tc.name === 'Skill') {
    const skillName = tc.input.skill as string | undefined
    if (skillName) {
      skillHits.push({ name: skillName, fullPath: tc.input.file_path as string | undefined, agentId: 'main', timestamp: ts, toolCallId: tc.id })
    }
  }

  if (tc.name === 'CallMcpTool' || tc.name === 'call_mcp_tool') {
    mcpCalls.push({
      server: (tc.input.server ?? '') as string,
      toolName: (tc.input.toolName ?? tc.input.tool_name ?? '') as string,
      arguments: tc.input.arguments as Record<string, unknown> | undefined,
      agentId: 'main',
      timestamp: ts,
      toolCallId: tc.id,
    })
  }
}

export async function listProxyCaptures(): Promise<SessionSummary[]> {
  const summaries: SessionSummary[] = []

  try {
    const files = await readdir(CAPTURES_DIR)
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl')).sort().reverse()

    for (const file of jsonlFiles) {
      const filePath = join(CAPTURES_DIR, file)
      try {
        const records = (await readJsonlFile(filePath)) as CaptureRecord[]
        const summary = buildCaptureSummary(file, filePath, records)
        if (summary) summaries.push(summary)
      } catch { /* skip */ }
    }
  } catch { /* dir may not exist */ }

  return summaries
}

function buildCaptureSummary(
  fileName: string,
  filePath: string,
  records: CaptureRecord[],
): SessionSummary | null {
  if (records.length === 0) return null

  const requestRec = records.find((r) => r.type === 'request')
  const responseRec = records.find((r) => r.type === 'response_complete')
  const provider = requestRec?.provider ?? 'anthropic'

  const model = responseRec?.model ?? requestRec?.model
  const startTime = records[0]?.timestamp ?? new Date().toISOString()
  const endTime = records[records.length - 1]?.timestamp

  const usageRec = responseRec?.usage ?? records.find((r) => r.usage)?.usage
  const tokenUsage = parseUsage(usageRec)

  const contentBlocks = records.filter((r) => r.type === 'content_block')
  const toolBlocks = contentBlocks.filter((r) => r.blockType === 'tool_use')
  const hasContentBlocks = contentBlocks.length > 0

  const filePathsSet = new Set<string>()
  for (const tb of toolBlocks) {
    const p = (tb.toolInput?.file_path ?? tb.toolInput?.path) as string | undefined
    if (p) filePathsSet.add(p)
  }

  let title = ''
  if (requestRec?.lastUserMessage) {
    title = requestRec.lastUserMessage.replace(/<[^>]+>/g, '').trim().slice(0, 100)
  }
  if (!title) {
    title = model ? `${model} — proxy capture` : `${provider} proxy capture`
  }

  const tool: ToolSource = provider === 'openai' ? 'codex' : 'claude-code'
  const captureId = records[0]?.captureId ?? basename(fileName, '.jsonl')

  return {
    id: `proxy-${captureId}`,
    tool,
    project: `[proxy: ${provider}]`,
    title,
    startTime: safeTimestamp(startTime),
    endTime: endTime ? safeTimestamp(endTime) : undefined,
    status: 'completed',
    model,
    turnCount: (requestRec ? 1 : 0) + (contentBlocks.length > 0 ? 1 : 0),
    toolCallCount: toolBlocks.length,
    fileOpCount: filePathsSet.size,
    agentCount: 1,
    tokenUsage,
    filePath,
    hasToolData: hasContentBlocks,
    dataAvailability: {
      toolCalls: hasContentBlocks ? 'full' : 'none',
      tokenUsage: tokenUsage.totalTokens > 0 ? 'full' : 'none',
      fileOps: hasContentBlocks ? 'full' : 'none',
      reason: hasContentBlocks
        ? undefined
        : 'Legacy proxy capture — upgrade proxy for full data',
    },
    dataSource: 'proxy',
  }
}

export async function parseProxyCaptureSession(filePath: string): Promise<Session> {
  const records = (await readJsonlFile(filePath)) as CaptureRecord[]
  const requestRec = records.find((r) => r.type === 'request')
  const responseRec = records.find((r) => r.type === 'response_complete')
  const provider = requestRec?.provider ?? 'anthropic'
  const model = responseRec?.model ?? requestRec?.model
  const captureId = records[0]?.captureId ?? genId()
  const tool: ToolSource = provider === 'openai' ? 'codex' : 'claude-code'

  const usageRec = responseRec?.usage ?? records.find((r) => r.usage)?.usage
  const tokenUsage = parseUsage(usageRec)

  const turns: Turn[] = []
  const fileOps: FileOp[] = []
  const skillHits: SkillHit[] = []
  const mcpCalls: McpCall[] = []
  const ruleRefs: RuleRef[] = []

  let title = ''

  if (requestRec) {
    const userText = requestRec.lastUserMessage
      ? requestRec.lastUserMessage
      : `[Proxy Request] ${requestRec.messagesCount ?? 0} messages, ${requestRec.toolsCount ?? 0} tools`

    if (requestRec.lastUserMessage) {
      title = requestRec.lastUserMessage.replace(/<[^>]+>/g, '').trim().slice(0, 100)
    }

    turns.push({
      id: genId(),
      agentId: 'main',
      role: 'user',
      blocks: [{ type: 'text', text: userText }],
      timestamp: safeTimestamp(requestRec.timestamp),
    })
  }

  const contentBlocks = records.filter((r) => r.type === 'content_block')

  if (contentBlocks.length > 0) {
    const blocks: ContentBlock[] = []
    let toolCallCount = 0

    for (const cb of contentBlocks) {
      const ts = safeTimestamp(cb.timestamp)

      if (cb.blockType === 'tool_use' && cb.toolName) {
        const tc: ToolCall = {
          id: cb.toolId ?? genId(),
          name: cb.toolName,
          category: categorizeToolCall(cb.toolName),
          input: (cb.toolInput ?? {}) as Record<string, unknown>,
          timestamp: ts,
        }
        blocks.push({ type: 'tool_use', toolCall: tc })
        toolCallCount++
        processProxyToolCall(tc, ts, fileOps, skillHits, mcpCalls, ruleRefs)
      } else if (cb.blockType === 'thinking' && cb.thinking) {
        blocks.push({ type: 'thinking', thinking: cb.thinking })
      } else if (cb.blockType === 'text' && cb.text) {
        blocks.push({ type: 'text', text: cb.text })
      }
    }

    if (blocks.length > 0) {
      turns.push({
        id: genId(),
        agentId: 'main',
        role: 'assistant',
        blocks,
        timestamp: safeTimestamp(contentBlocks[0]?.timestamp),
        tokenUsage,
      })
    }
  } else if (responseRec) {
    const summary = `Model: ${responseRec.model ?? 'unknown'}, Stop: ${responseRec.stopReason ?? 'unknown'}`
    turns.push({
      id: genId(),
      agentId: 'main',
      role: 'assistant',
      blocks: [{ type: 'text', text: `[Proxy Response] ${summary}` }],
      timestamp: safeTimestamp(responseRec.timestamp),
      tokenUsage,
    })
  }

  if (!title) {
    title = model ? `${model} — proxy capture` : `${provider} proxy capture`
  }

  const timestamps = records.map((r) => r.timestamp).filter(Boolean)
  const toolCallCount = turns
    .flatMap((t) => t.blocks)
    .filter((b) => b.type === 'tool_use').length

  return {
    id: `proxy-${captureId}`,
    tool,
    project: `[proxy: ${provider}]`,
    title,
    startTime: safeTimestamp(timestamps[0]),
    endTime: safeTimestamp(timestamps[timestamps.length - 1]),
    status: 'completed',
    model,
    turns,
    agents: [{
      id: 'main',
      name: 'Main Agent',
      status: 'completed',
      tokenUsage,
      toolCallCount,
      turnCount: turns.length,
    }],
    fileOps,
    tokenUsage,
    skillHits,
    mcpCalls,
    ruleRefs,
  }
}
