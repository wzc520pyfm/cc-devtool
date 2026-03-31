import { mkdirSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

const CAPTURES_DIR = join(homedir(), '.cc-devtool', 'captures')
const MAX_TEXT_LEN = 10_000

export function getCapturesDir(): string {
  return CAPTURES_DIR
}

export function ensureCapturesDir() {
  if (!existsSync(CAPTURES_DIR)) {
    mkdirSync(CAPTURES_DIR, { recursive: true })
  }
}

interface AccumulatingBlock {
  index: number
  type: string
  text: string
  name?: string
  id?: string
}

export interface CaptureSession {
  id: string
  provider: 'anthropic' | 'openai'
  model?: string
  filePath: string
  startTime: string
  _blocks: Map<number, AccumulatingBlock>
}

export function startCapture(provider: 'anthropic' | 'openai'): CaptureSession {
  ensureCapturesDir()
  const id = randomUUID()
  const startTime = new Date().toISOString()
  const date = startTime.slice(0, 10)
  const filePath = join(CAPTURES_DIR, `${date}_${provider}_${id}.jsonl`)

  return { id, provider, filePath, startTime, _blocks: new Map() }
}

export function appendCapture(session: CaptureSession, record: Record<string, unknown>) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    captureId: session.id,
    ...record,
  })
  appendFileSync(session.filePath, line + '\n')
}

export function captureRequest(
  session: CaptureSession,
  body: Record<string, unknown>,
  headers: Record<string, string>,
) {
  session.model = (body.model as string) ?? undefined

  let lastUserMessage = ''
  if (Array.isArray(body.messages)) {
    const msgs = body.messages as Array<{ role?: string; content?: unknown }>
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')
    if (lastUser) {
      if (typeof lastUser.content === 'string') {
        lastUserMessage = lastUser.content.slice(0, MAX_TEXT_LEN)
      } else if (Array.isArray(lastUser.content)) {
        lastUserMessage = (lastUser.content as Array<{ type?: string; text?: string }>)
          .filter(b => b.type === 'text')
          .map(b => b.text ?? '')
          .join('\n')
          .slice(0, MAX_TEXT_LEN)
      }
    }
  }

  appendCapture(session, {
    type: 'request',
    provider: session.provider,
    model: body.model,
    stream: body.stream ?? false,
    messagesCount: Array.isArray(body.messages) ? body.messages.length : 0,
    toolsCount: Array.isArray(body.tools) ? body.tools.length : 0,
    hasSystem: !!body.system,
    maxTokens: body.max_tokens ?? body.max_output_tokens,
    lastUserMessage,
  })
}

function finalizeBlock(session: CaptureSession, index: number) {
  const acc = session._blocks.get(index)
  if (!acc) return
  const record: Record<string, unknown> = {
    type: 'content_block',
    index: acc.index,
    blockType: acc.type,
  }
  if (acc.type === 'tool_use') {
    record.toolName = acc.name
    record.toolId = acc.id
    try { record.toolInput = JSON.parse(acc.text) }
    catch { record.toolInput = acc.text }
  } else if (acc.type === 'thinking') {
    record.thinking = acc.text.slice(0, MAX_TEXT_LEN)
  } else {
    record.text = acc.text.slice(0, MAX_TEXT_LEN)
  }
  appendCapture(session, record)
  session._blocks.delete(index)
}

export function captureStreamEvent(
  session: CaptureSession,
  eventData: string,
) {
  try {
    const parsed = JSON.parse(eventData)
    const eventType = parsed.type ?? parsed.object ?? 'unknown'

    if (eventType === 'message_start' || eventType === 'message_delta') {
      appendCapture(session, {
        type: 'stream_event',
        eventType,
        model: parsed.message?.model ?? parsed.model,
        usage: parsed.message?.usage ?? parsed.usage,
      })
    } else if (eventType === 'content_block_start') {
      const index = parsed.index ?? 0
      const block = parsed.content_block ?? {}
      session._blocks.set(index, {
        index,
        type: block.type ?? 'text',
        text: '',
        name: block.name,
        id: block.id,
      })
    } else if (eventType === 'content_block_delta') {
      const index = parsed.index ?? 0
      const delta = parsed.delta ?? {}
      const acc = session._blocks.get(index)
      if (acc) {
        if (delta.type === 'text_delta') acc.text += delta.text ?? ''
        else if (delta.type === 'input_json_delta') acc.text += delta.partial_json ?? ''
        else if (delta.type === 'thinking_delta') acc.text += delta.thinking ?? ''
      }
    } else if (eventType === 'content_block_stop') {
      finalizeBlock(session, parsed.index ?? 0)
    } else if (eventType === 'message_stop') {
      for (const idx of session._blocks.keys()) finalizeBlock(session, idx)
      appendCapture(session, { type: 'stream_event', eventType })
    }
  } catch { /* not JSON, ignore */ }
}

export function captureResponse(
  session: CaptureSession,
  body: Record<string, unknown>,
) {
  appendCapture(session, {
    type: 'response_complete',
    provider: session.provider,
    model: body.model,
    stopReason: body.stop_reason ?? body.finish_reason,
    usage: body.usage,
    contentTypes: Array.isArray(body.content)
      ? (body.content as { type?: string }[]).map((b) => b.type)
      : undefined,
  })

  if (Array.isArray(body.content)) {
    for (let i = 0; i < (body.content as unknown[]).length; i++) {
      const block = (body.content as Array<Record<string, unknown>>)[i]
      const record: Record<string, unknown> = {
        type: 'content_block',
        index: i,
        blockType: block.type,
      }
      if (block.type === 'tool_use') {
        record.toolName = block.name
        record.toolId = block.id
        record.toolInput = block.input
      } else if (block.type === 'thinking') {
        record.thinking = ((block.thinking as string) ?? '').slice(0, MAX_TEXT_LEN)
      } else if (block.type === 'text') {
        record.text = ((block.text as string) ?? '').slice(0, MAX_TEXT_LEN)
      }
      appendCapture(session, record)
    }
  }
}

export function captureOpenAIStreamEvent(
  session: CaptureSession,
  eventData: string,
) {
  if (eventData === '[DONE]') {
    for (const idx of session._blocks.keys()) finalizeBlock(session, idx)
    appendCapture(session, { type: 'stream_event', eventType: 'done' })
    return
  }

  try {
    const parsed = JSON.parse(eventData)

    if (parsed.usage) {
      appendCapture(session, {
        type: 'stream_event',
        eventType: 'usage',
        model: parsed.model,
        usage: parsed.usage,
      })
    }

    if (parsed.type === 'response.completed' || parsed.type === 'response.done') {
      const response = parsed.response ?? parsed
      appendCapture(session, {
        type: 'response_complete',
        provider: 'openai',
        model: response.model ?? parsed.model,
        usage: response.usage ?? parsed.usage,
        outputItems: Array.isArray(response.output) ? response.output.length : undefined,
      })

      if (Array.isArray(response.output)) {
        for (let i = 0; i < response.output.length; i++) {
          const item = response.output[i]
          if (item.type === 'function_call') {
            let toolInput: unknown = item.arguments
            try { toolInput = JSON.parse(item.arguments ?? '{}') } catch { /* */ }
            appendCapture(session, {
              type: 'content_block',
              index: i,
              blockType: 'tool_use',
              toolName: item.name,
              toolId: item.call_id,
              toolInput,
            })
          } else if (item.type === 'message' && Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.type === 'output_text') {
                appendCapture(session, {
                  type: 'content_block',
                  index: i,
                  blockType: 'text',
                  text: ((part.text as string) ?? '').slice(0, MAX_TEXT_LEN),
                })
              }
            }
          }
        }
      }
    }

    if (parsed.choices && Array.isArray(parsed.choices)) {
      for (const choice of parsed.choices) {
        const delta = choice.delta
        if (!delta) continue

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0
            if (tc.function?.name) {
              session._blocks.set(index, {
                index,
                type: 'tool_use',
                text: tc.function.arguments ?? '',
                name: tc.function.name,
                id: tc.id,
              })
            } else if (tc.function?.arguments) {
              const acc = session._blocks.get(index)
              if (acc) acc.text += tc.function.arguments
            }
          }
        }

        if (choice.finish_reason) {
          for (const idx of session._blocks.keys()) finalizeBlock(session, idx)
        }
      }
    }
  } catch { /* not JSON */ }
}

export function captureError(session: CaptureSession, error: string, statusCode?: number) {
  appendCapture(session, {
    type: 'error',
    statusCode,
    error,
  })
}
