import express from 'express'
import { createServer } from 'http'
import { createAnthropicProxy } from './anthropic.js'
import { createOpenAIProxy } from './openai.js'
import { ensureCapturesDir, getCapturesDir } from './capture.js'

export interface ProxyOptions {
  port: number
  anthropicUpstream?: string
  openaiUpstream?: string
}

export async function startProxyServer(options: ProxyOptions) {
  ensureCapturesDir()

  const app = express()
  const server = createServer(app)

  app.use(express.json({ limit: '50mb' }))
  app.use(express.text({ type: 'text/*', limit: '50mb' }))

  app.use('/anthropic', createAnthropicProxy(options.anthropicUpstream))
  app.use('/openai', createOpenAIProxy(options.openaiUpstream))

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      anthropicUpstream: options.anthropicUpstream ?? 'https://api.anthropic.com',
      openaiUpstream: options.openaiUpstream ?? 'https://api.openai.com',
      capturesDir: getCapturesDir(),
    })
  })

  server.listen(options.port, () => {
    console.log(`\n  cc-devtool proxy running at http://localhost:${options.port}`)
    console.log(`  Captures saved to: ${getCapturesDir()}`)
    console.log()
    console.log('  Anthropic upstream: ' + (options.anthropicUpstream ?? 'https://api.anthropic.com'))
    console.log('  OpenAI upstream:    ' + (options.openaiUpstream ?? 'https://api.openai.com'))
    console.log()
    console.log('  Usage:')
    console.log(`    ANTHROPIC_BASE_URL=http://localhost:${options.port}/anthropic claude`)
    console.log(`    OPENAI_BASE_URL=http://localhost:${options.port}/openai codex`)
    console.log()
  })

  return server
}
