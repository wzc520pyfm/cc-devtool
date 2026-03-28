import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  startCapture,
  captureRequest,
  captureOpenAIStreamEvent,
  captureResponse,
  captureError,
} from './capture.js'

const DEFAULT_UPSTREAM = 'https://api.openai.com'

export function createOpenAIProxy(upstream?: string) {
  const router = Router()
  const baseUrl = (upstream ?? DEFAULT_UPSTREAM).replace(/\/$/, '')

  router.all('/*path', async (req: Request, res: Response) => {
    const targetUrl = `${baseUrl}${req.originalUrl.replace(/^\/openai/, '')}`
    const session = startCapture('openai')

    const forwardHeaders: Record<string, string> = {}
    for (const [key, val] of Object.entries(req.headers)) {
      if (key === 'host' || key === 'connection' || key === 'content-length') continue
      if (typeof val === 'string') forwardHeaders[key] = val
    }

    const body = req.body as Record<string, unknown>
    const isStream = body?.stream === true

    captureRequest(session, body, forwardHeaders)

    try {
      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers: {
          ...forwardHeaders,
          'content-type': 'application/json',
        },
        body: req.method !== 'GET' ? JSON.stringify(body) : undefined,
      })

      res.status(upstreamRes.status)
      for (const [key, val] of upstreamRes.headers.entries()) {
        if (key === 'transfer-encoding' || key === 'content-encoding') continue
        res.setHeader(key, val)
      }

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text()
        captureError(session, errText, upstreamRes.status)
        res.send(errText)
        return
      }

      if (isStream && upstreamRes.body) {
        res.setHeader('content-type', 'text/event-stream')
        res.setHeader('cache-control', 'no-cache')
        res.setHeader('connection', 'keep-alive')
        res.flushHeaders()

        const reader = upstreamRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk
            res.write(chunk)

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                captureOpenAIStreamEvent(session, line.slice(6).trim())
              }
            }
          }

          if (buffer.startsWith('data: ')) {
            captureOpenAIStreamEvent(session, buffer.slice(6).trim())
          }
        } catch (err) {
          captureError(session, String(err))
        } finally {
          res.end()
        }
      } else {
        const responseText = await upstreamRes.text()
        try {
          const responseJson = JSON.parse(responseText)
          captureResponse(session, responseJson)
        } catch { /* not json */ }
        res.send(responseText)
      }
    } catch (err) {
      captureError(session, String(err))
      res.status(502).json({ error: 'Proxy upstream error', detail: String(err) })
    }
  })

  return router
}
