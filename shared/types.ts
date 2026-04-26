export type ToolSource = 'claude-code' | 'cursor' | 'codex'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
}

export interface DataAvailability {
  toolCalls: 'full' | 'partial' | 'none'
  tokenUsage: 'full' | 'partial' | 'none'
  fileOps: 'full' | 'partial' | 'none'
  reason?: string
}

export interface SessionSummary {
  id: string
  tool: ToolSource
  project: string
  title: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed'
  model?: string
  turnCount: number
  toolCallCount: number
  fileOpCount: number
  agentCount: number
  tokenUsage: TokenUsage
  filePath: string
  hasToolData: boolean
  dataAvailability?: DataAvailability
  codeStats?: CodeStats
  gitContext?: GitContext
  dataSource?: 'local' | 'proxy' | 'local+proxy'
}

export interface Session {
  id: string
  tool: ToolSource
  project: string
  title: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed'
  model?: string
  turns: Turn[]
  agents: AgentNode[]
  fileOps: FileOp[]
  tokenUsage: TokenUsage
  skillHits: SkillHit[]
  mcpCalls: McpCall[]
  ruleRefs: RuleRef[]
}

export interface Turn {
  id: string
  agentId: string
  role: 'user' | 'assistant' | 'system'
  blocks: ContentBlock[]
  timestamp: string
  tokenUsage?: TokenUsage
}

export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolUseBlock
  | ToolResultBlock

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  toolCall: ToolCall
}

export interface ToolResultBlock {
  type: 'tool_result'
  toolCallId: string
  result: string
}

export type ToolCategory =
  | 'file_read'
  | 'file_write'
  | 'shell'
  | 'search'
  | 'skill'
  | 'mcp'
  | 'agent'
  | 'other'

export interface ToolCall {
  id: string
  name: string
  category: ToolCategory
  input: Record<string, unknown>
  result?: string
  timestamp: string
  duration?: number
}

export interface FileOp {
  path: string
  type: 'read' | 'create' | 'update' | 'delete'
  agentId: string
  timestamp: string
  toolCallId: string
}

export interface AgentNode {
  id: string
  parentId?: string
  name: string
  description?: string
  status: 'running' | 'completed' | 'error'
  tokenUsage: TokenUsage
  toolCallCount: number
  turnCount: number
}

export interface SkillHit {
  name: string
  fullPath?: string
  agentId: string
  timestamp: string
  toolCallId: string
}

export interface McpCall {
  server: string
  toolName: string
  arguments?: Record<string, unknown>
  agentId: string
  timestamp: string
  toolCallId: string
}

export interface RuleRef {
  path: string
  agentId: string
  timestamp: string
}

export interface RawFileResponse {
  content: string
  filePath: string
  format: 'jsonl' | 'txt'
  size: number
}

export interface CodeStats {
  codeBlocks: number
  uniqueFiles: number
  aiPercentage?: number
}

export interface GitContext {
  branch?: string
  sha?: string
  originUrl?: string
}

export function emptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
  }
}

export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  }
}

export function categorizeToolCall(name: string): ToolCategory {
  const fileRead = ['Read', 'Grep', 'Glob', 'SemanticSearch', 'ReadLints', 'read_file']
  const fileWrite = ['Write', 'StrReplace', 'Delete', 'EditNotebook', 'ApplyPatch', 'write_file', 'apply_patch']
  const shell = ['Shell', 'AwaitShell', 'exec_command']
  const search = ['WebSearch', 'WebFetch', 'FetchMcpResource']
  const skill = ['Skill']
  const agent = ['Task', 'GenerateImage', 'AskQuestion']

  if (fileRead.includes(name)) return 'file_read'
  if (fileWrite.includes(name)) return 'file_write'
  if (shell.includes(name)) return 'shell'
  if (search.includes(name)) return 'search'
  if (skill.includes(name)) return 'skill'
  if (agent.includes(name)) return 'agent'
  if (name === 'CallMcpTool' || name === 'call_mcp_tool') return 'mcp'
  return 'other'
}
