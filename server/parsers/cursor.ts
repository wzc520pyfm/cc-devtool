import { readdir, stat, readFile } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { readJsonlFile, extractUserQuery, genId, safeTimestamp } from './utils.js'
import {
  emptyTokenUsage,
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
} from './types.js'

const CURSOR_DIR = join(homedir(), '.cursor')

export function getCursorBaseDir(): string {
  return CURSOR_DIR
}

interface CursorRecord {
  role: string
  message: {
    content: { type: string; text: string }[]
  }
}

export async function listCursorSessions(): Promise<SessionSummary[]> {
  const projectsDir = join(CURSOR_DIR, 'projects')
  const sessionMap = new Map<string, SessionSummary>()

  try {
    const projectDirs = await readdir(projectsDir)
    for (const projDir of projectDirs) {
      const transcriptsDir = join(projectsDir, projDir, 'agent-transcripts')
      const st = await stat(transcriptsDir).catch(() => null)
      if (!st?.isDirectory()) continue

      const entries = await readdir(transcriptsDir).catch(() => [] as string[])
      for (const entry of entries) {
        const entryPath = join(transcriptsDir, entry)
        const entryStat = await stat(entryPath).catch(() => null)

        if (entryStat?.isDirectory()) {
          const jsonlPath = join(entryPath, `${entry}.jsonl`)
          const jsonlStat = await stat(jsonlPath).catch(() => null)
          if (jsonlStat?.isFile()) {
            const summary = await buildCursorSummary(entry, projDir, jsonlPath, transcriptsDir)
            if (summary) sessionMap.set(summary.id, summary)
          }
        }

        if (entry.endsWith('.txt')) {
          const sessionId = basename(entry, '.txt')
          if (!sessionMap.has(sessionId)) {
            const summary = await buildCursorTxtSummary(sessionId, projDir, entryPath)
            if (summary) sessionMap.set(summary.id, summary)
          }
        }
      }
    }
  } catch { /* cursor dir may not exist */ }

  return [...sessionMap.values()]
}

async function buildCursorSummary(
  sessionId: string,
  projectDir: string,
  filePath: string,
  transcriptsDir: string,
): Promise<SessionSummary | null> {
  const records = (await readJsonlFile(filePath)) as CursorRecord[]
  if (records.length === 0) return null

  const project = decodeCursorProject(projectDir)
  const firstUser = records.find((r) => r.role === 'user')
  let title = sessionId
  if (firstUser?.message?.content) {
    const text = firstUser.message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
    title = extractUserQuery(text) || text.slice(0, 100)
  }

  const fileStat = await stat(filePath).catch(() => null)
  const startTime = fileStat ? new Date(fileStat.birthtime).toISOString() : new Date().toISOString()
  const endTime = fileStat ? new Date(fileStat.mtime).toISOString() : undefined

  const toolCalls = extractToolCallsFromRecords(records)
  const subagentsDir = join(transcriptsDir, sessionId, 'subagents')
  let agentCount = 1
  try {
    const subs = await readdir(subagentsDir)
    agentCount += subs.filter((f) => f.endsWith('.jsonl')).length
  } catch { /* no subagents */ }

  return {
    id: sessionId,
    tool: 'cursor',
    project,
    title,
    startTime,
    endTime,
    status: 'completed',
    turnCount: records.length,
    toolCallCount: toolCalls.length,
    fileOpCount: new Set(toolCalls.filter((t) => t.category === 'file_read' || t.category === 'file_write').map((t) => (t.input.path as string) ?? '')).size,
    agentCount,
    tokenUsage: emptyTokenUsage(),
    filePath,
  }
}

async function buildCursorTxtSummary(
  sessionId: string,
  projectDir: string,
  filePath: string,
): Promise<SessionSummary | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const project = decodeCursorProject(projectDir)

    let title = sessionId
    for (const line of lines) {
      if (line.startsWith('<user_query>')) {
        const match = content.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/)
        if (match) title = match[1].slice(0, 100)
        break
      }
    }

    const toolCallMatches = content.match(/\[Tool call\]/g)
    const fileStat = await stat(filePath).catch(() => null)

    return {
      id: sessionId,
      tool: 'cursor',
      project,
      title,
      startTime: fileStat ? new Date(fileStat.birthtime).toISOString() : new Date().toISOString(),
      endTime: fileStat ? new Date(fileStat.mtime).toISOString() : undefined,
      status: 'completed',
      turnCount: (content.match(/^(user|assistant):/gm) ?? []).length,
      toolCallCount: toolCallMatches?.length ?? 0,
      fileOpCount: 0,
      agentCount: 1,
      tokenUsage: emptyTokenUsage(),
      filePath,
    }
  } catch {
    return null
  }
}

function decodeCursorProject(encoded: string): string {
  return encoded.replace(/^Users-/, '/Users/').replace(/-/g, '/')
}

function extractToolCallsFromRecords(records: CursorRecord[]): ToolCall[] {
  const tools: ToolCall[] = []
  for (const rec of records) {
    if (rec.role !== 'assistant') continue
    for (const block of rec.message?.content ?? []) {
      if (block.type !== 'text') continue
      const extracted = parseToolCallsFromText(block.text)
      tools.push(...extracted)
    }
  }
  return tools
}

function parseToolCallsFromText(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = []
  const toolPattern = /\[Tool call\]\s+(\w+)/g
  let match: RegExpExecArray | null

  while ((match = toolPattern.exec(text)) !== null) {
    const name = match[1]
    const startIdx = match.index + match[0].length
    const nextToolIdx = text.indexOf('[Tool call]', startIdx)
    const nextResultIdx = text.indexOf('[Tool result]', startIdx)
    const endIdx = Math.min(
      nextToolIdx === -1 ? text.length : nextToolIdx,
      nextResultIdx === -1 ? text.length : nextResultIdx,
    )
    const paramText = text.slice(startIdx, endIdx).trim()
    const input = parseParams(paramText)

    toolCalls.push({
      id: genId(),
      name,
      category: categorizeToolCall(name),
      input,
      timestamp: new Date().toISOString(),
    })
  }

  return toolCalls
}

function parseParams(text: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  const lines = text.split('\n')
  let currentKey = ''
  let currentValue = ''

  for (const line of lines) {
    const keyMatch = line.match(/^\s{2}(\w+):\s*(.*)/)
    if (keyMatch) {
      if (currentKey) {
        params[currentKey] = tryParseJson(currentValue.trim())
      }
      currentKey = keyMatch[1]
      currentValue = keyMatch[2]
    } else if (currentKey && line.startsWith('    ')) {
      currentValue += '\n' + line.trimStart()
    }
  }
  if (currentKey) {
    params[currentKey] = tryParseJson(currentValue.trim())
  }

  return params
}

function tryParseJson(val: string): unknown {
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

export async function parseCursorSession(filePath: string): Promise<Session> {
  const isTxt = filePath.endsWith('.txt')
  if (isTxt) return parseCursorTxtSession(filePath)

  const records = (await readJsonlFile(filePath)) as CursorRecord[]
  const sessionId = basename(filePath, '.jsonl')
  const projectDir = basename(join(filePath, '../../..'))
  const project = decodeCursorProject(projectDir)

  const turns: Turn[] = []
  const fileOps: FileOp[] = []
  const skillHits: SkillHit[] = []
  const mcpCalls: McpCall[] = []
  const ruleRefs: RuleRef[] = []
  let title = ''

  for (const rec of records) {
    const textParts = (rec.message?.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
    const fullText = textParts.join('\n')

    if (rec.role === 'user' && !title) {
      title = extractUserQuery(fullText) || fullText.slice(0, 100)
    }

    const blocks: ContentBlock[] = [{ type: 'text', text: fullText }]

    const toolCalls = parseToolCallsFromText(fullText)
    for (const tc of toolCalls) {
      blocks.push({ type: 'tool_use', toolCall: tc })
      processFileOp(tc, 'main', fileOps, skillHits, mcpCalls, ruleRefs)
    }

    turns.push({
      id: genId(),
      agentId: 'main',
      role: rec.role as 'user' | 'assistant' | 'system',
      blocks,
      timestamp: new Date().toISOString(),
    })
  }

  const subagentsDir = join(filePath, '../subagents')
  const agents: AgentNode[] = [
    {
      id: 'main',
      name: 'Main Agent',
      status: 'completed',
      tokenUsage: emptyTokenUsage(),
      toolCallCount: turns.flatMap((t) => t.blocks).filter((b) => b.type === 'tool_use').length,
      turnCount: turns.length,
    },
  ]

  try {
    const subFiles = await readdir(subagentsDir)
    for (const sf of subFiles) {
      if (!sf.endsWith('.jsonl')) continue
      const subId = basename(sf, '.jsonl')
      agents.push({
        id: subId,
        parentId: 'main',
        name: `Subagent ${subId.slice(0, 8)}`,
        status: 'completed',
        tokenUsage: emptyTokenUsage(),
        toolCallCount: 0,
        turnCount: 0,
      })
    }
  } catch { /* no subagents */ }

  const fileStat = await stat(filePath).catch(() => null)

  return {
    id: sessionId,
    tool: 'cursor',
    project,
    title,
    startTime: fileStat ? new Date(fileStat.birthtime).toISOString() : new Date().toISOString(),
    endTime: fileStat ? new Date(fileStat.mtime).toISOString() : undefined,
    status: 'completed',
    turns,
    agents,
    fileOps,
    tokenUsage: emptyTokenUsage(),
    skillHits,
    mcpCalls,
    ruleRefs,
  }
}

async function parseCursorTxtSession(filePath: string): Promise<Session> {
  const content = await readFile(filePath, 'utf-8')
  const sessionId = basename(filePath, '.txt')
  const projectDir = basename(join(filePath, '../..'))
  const project = decodeCursorProject(projectDir)

  const turns: Turn[] = []
  const fileOps: FileOp[] = []
  const skillHits: SkillHit[] = []
  const mcpCalls: McpCall[] = []
  const ruleRefs: RuleRef[] = []
  let title = ''

  const sections = content.split(/^(user|assistant):\s*$/m)
  let currentRole = ''

  for (const section of sections) {
    const trimmed = section.trim()
    if (trimmed === 'user' || trimmed === 'assistant') {
      currentRole = trimmed
      continue
    }
    if (!currentRole || !trimmed) continue

    if (currentRole === 'user' && !title) {
      title = extractUserQuery(trimmed) || trimmed.slice(0, 100)
    }

    const blocks: ContentBlock[] = []

    const thinkingMatches = trimmed.match(/\[Thinking\]\s*([\s\S]*?)(?=\[Tool call\]|\[Tool result\]|$)/g)
    if (thinkingMatches) {
      for (const tm of thinkingMatches) {
        const thinking = tm.replace(/^\[Thinking\]\s*/, '').trim()
        if (thinking) blocks.push({ type: 'thinking', thinking })
      }
    }

    const toolCalls = parseToolCallsFromText(trimmed)
    for (const tc of toolCalls) {
      blocks.push({ type: 'tool_use', toolCall: tc })
      processFileOp(tc, 'main', fileOps, skillHits, mcpCalls, ruleRefs)
    }

    const cleanText = trimmed
      .replace(/\[Thinking\][\s\S]*?(?=\[Tool call\]|\[Tool result\]|$)/g, '')
      .replace(/\[Tool call\][\s\S]*?(?=\[Tool call\]|\[Tool result\]|user:|assistant:|$)/g, '')
      .replace(/\[Tool result\][\s\S]*?(?=\[Tool call\]|user:|assistant:|$)/g, '')
      .trim()

    if (cleanText) {
      blocks.unshift({ type: 'text', text: cleanText })
    }

    if (blocks.length === 0) {
      blocks.push({ type: 'text', text: trimmed.slice(0, 500) })
    }

    turns.push({
      id: genId(),
      agentId: 'main',
      role: currentRole as 'user' | 'assistant',
      blocks,
      timestamp: new Date().toISOString(),
    })
  }

  const fileStat = await stat(filePath).catch(() => null)

  return {
    id: sessionId,
    tool: 'cursor',
    project,
    title,
    startTime: fileStat ? new Date(fileStat.birthtime).toISOString() : new Date().toISOString(),
    endTime: fileStat ? new Date(fileStat.mtime).toISOString() : undefined,
    status: 'completed',
    turns,
    agents: [{
      id: 'main',
      name: 'Main Agent',
      status: 'completed',
      tokenUsage: emptyTokenUsage(),
      toolCallCount: turns.flatMap((t) => t.blocks).filter((b) => b.type === 'tool_use').length,
      turnCount: turns.length,
    }],
    fileOps,
    tokenUsage: emptyTokenUsage(),
    skillHits,
    mcpCalls,
    ruleRefs,
  }
}

function processFileOp(
  tc: ToolCall,
  agentId: string,
  fileOps: FileOp[],
  skillHits: SkillHit[],
  mcpCalls: McpCall[],
  ruleRefs: RuleRef[],
) {
  const path = (tc.input.path ?? tc.input.file_path) as string | undefined

  if (tc.category === 'file_read' && path) {
    fileOps.push({ path, type: 'read', agentId, timestamp: tc.timestamp, toolCallId: tc.id })
    if (path.includes('.cursor/rules/') || path.includes('CLAUDE.md') || path.includes('SKILL.md')) {
      ruleRefs.push({ path, agentId, timestamp: tc.timestamp })
    }
  }

  if (tc.name === 'Write' && path) {
    fileOps.push({ path, type: 'create', agentId, timestamp: tc.timestamp, toolCallId: tc.id })
  }

  if ((tc.name === 'StrReplace' || tc.name === 'EditNotebook') && path) {
    fileOps.push({ path, type: 'update', agentId, timestamp: tc.timestamp, toolCallId: tc.id })
  }

  if (tc.name === 'CallMcpTool') {
    mcpCalls.push({
      server: (tc.input.server ?? '') as string,
      toolName: (tc.input.toolName ?? '') as string,
      arguments: tc.input.arguments as Record<string, unknown> | undefined,
      agentId,
      timestamp: tc.timestamp,
      toolCallId: tc.id,
    })
  }
}
