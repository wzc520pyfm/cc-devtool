import { mkdirSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

const CAPTURES_DIR = join(homedir(), '.cc-devtool', 'captures')

export function getCapturesDir(): string {
  return CAPTURES_DIR
}

export function ensureCapturesDir() {
  if (!existsSync(CAPTURES_DIR)) {
    mkdirSync(CAPTURES_DIR, { recursive: true })
  }
}

export interface CaptureSession {
  id: string
  provider: 'anthropic' | 'openai'
  model?: string
  filePath: string
  startTime: string
}

export function startCapture(provider: 'anthropic' | 'openai'): CaptureSession {
  ensureCapturesDir()
  const id = randomUUID()
  const startTime = new Date().toISOString()
  const date = startTime.slice(0, 10)
  const filePath = join(CAPTURES_DIR, `${date}_${provider}_${id}.jsonl`)

  return { id, provider, filePath, startTime }
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

  appendCapture(session, {
    type: 'request',
    provider: session.provider,
    model: body.model,
    stream: body.stream ?? false,
    messagesCount: Array.isArray(body.messages) ? body.messages.length : 0,
    toolsCount: Array.isArray(body.tools) ? body.tools.length : 0,
    hasSystem: !!body.system,
    maxTokens: body.max_tokens ?? body.max_output_tokens,
  })
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
      appendCapture(session, {
        type: 'stream_event',
        eventType,
        index: parsed.index,
        blockType: parsed.content_block?.type,
        toolName: parsed.content_block?.name,
      })
    } else if (eventType === 'message_stop') {
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
}

export function captureOpenAIStreamEvent(
  session: CaptureSession,
  eventData: string,
) {
  if (eventData === '[DONE]') {
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
      appendCapture(session, {
        type: 'response_complete',
        provider: 'openai',
        model: parsed.response?.model ?? parsed.model,
        usage: parsed.response?.usage ?? parsed.usage,
        outputItems: parsed.response?.output?.length,
      })
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
