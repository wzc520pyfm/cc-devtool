import { readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { readJsonlFile, genId, safeTimestamp } from './utils.js'
import { emptyTokenUsage } from './types.js'
import type {
  SessionSummary,
  Session,
  Turn,
  TokenUsage,
  ToolSource,
} from './types.js'

const CAPTURES_DIR = join(homedir(), '.cc-devtool', 'captures')

export function getCapturesBaseDir(): string {
  return CAPTURES_DIR
}

interface CaptureRecord {
  timestamp: string
  captureId: string
  type: 'request' | 'stream_event' | 'response_complete' | 'error'
  provider?: 'anthropic' | 'openai'
  model?: string
  stream?: boolean
  messagesCount?: number
  toolsCount?: number
  maxTokens?: number
  eventType?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    total_tokens?: number
  }
  stopReason?: string
  contentTypes?: string[]
  error?: string
  statusCode?: number
  blockType?: string
  toolName?: string
  outputItems?: number
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

  let tokenUsage = emptyTokenUsage()
  const usageRec = responseRec?.usage ?? records.find((r) => r.usage)?.usage
  if (usageRec) {
    tokenUsage = {
      inputTokens: usageRec.input_tokens ?? 0,
      outputTokens: usageRec.output_tokens ?? 0,
      cacheCreationTokens: usageRec.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usageRec.cache_read_input_tokens ?? 0,
      totalTokens: usageRec.total_tokens ??
        ((usageRec.input_tokens ?? 0) + (usageRec.output_tokens ?? 0)),
    }
  }

  const toolBlocks = records.filter(
    (r) => r.type === 'stream_event' && r.blockType === 'tool_use',
  )

  const tool: ToolSource = provider === 'openai' ? 'codex' : 'claude-code'
  const captureId = records[0]?.captureId ?? basename(fileName, '.jsonl')

  return {
    id: `proxy-${captureId}`,
    tool,
    project: `[proxy: ${provider}]`,
    title: model ? `${model} — proxy capture` : `${provider} proxy capture`,
    startTime: safeTimestamp(startTime),
    endTime: endTime ? safeTimestamp(endTime) : undefined,
    status: 'completed',
    model,
    turnCount: requestRec ? 1 : 0,
    toolCallCount: toolBlocks.length,
    fileOpCount: 0,
    agentCount: 1,
    tokenUsage,
    filePath,
    hasToolData: true,
    dataAvailability: {
      toolCalls: toolBlocks.length > 0 ? 'partial' : 'none',
      tokenUsage: tokenUsage.totalTokens > 0 ? 'full' : 'none',
      fileOps: 'none',
      reason: 'Proxy capture — API-level data only',
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

  let tokenUsage = emptyTokenUsage()
  const usageRec = responseRec?.usage ?? records.find((r) => r.usage)?.usage
  if (usageRec) {
    tokenUsage = {
      inputTokens: usageRec.input_tokens ?? 0,
      outputTokens: usageRec.output_tokens ?? 0,
      cacheCreationTokens: usageRec.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usageRec.cache_read_input_tokens ?? 0,
      totalTokens: usageRec.total_tokens ??
        ((usageRec.input_tokens ?? 0) + (usageRec.output_tokens ?? 0)),
    }
  }

  const turns: Turn[] = []

  if (requestRec) {
    turns.push({
      id: genId(),
      agentId: 'main',
      role: 'user',
      blocks: [{
        type: 'text',
        text: `[Proxy Request] ${requestRec.messagesCount ?? 0} messages, ${requestRec.toolsCount ?? 0} tools`,
      }],
      timestamp: safeTimestamp(requestRec.timestamp),
    })
  }

  const streamEvents = records.filter((r) => r.type === 'stream_event')
  if (streamEvents.length > 0 || responseRec) {
    const summary = responseRec
      ? `Model: ${responseRec.model ?? 'unknown'}, Stop: ${responseRec.stopReason ?? 'unknown'}`
      : `${streamEvents.length} stream events`

    turns.push({
      id: genId(),
      agentId: 'main',
      role: 'assistant',
      blocks: [{ type: 'text', text: `[Proxy Response] ${summary}` }],
      timestamp: safeTimestamp(responseRec?.timestamp ?? streamEvents[0]?.timestamp),
      tokenUsage,
    })
  }

  const timestamps = records.map((r) => r.timestamp).filter(Boolean)

  return {
    id: `proxy-${captureId}`,
    tool,
    project: `[proxy: ${provider}]`,
    title: model ? `${model} — proxy capture` : `${provider} proxy capture`,
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
      toolCallCount: 0,
      turnCount: turns.length,
    }],
    fileOps: [],
    tokenUsage,
    skillHits: [],
    mcpCalls: [],
    ruleRefs: [],
  }
}
