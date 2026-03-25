import express from 'express'
import { createServer } from 'http'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { setupWebSocket } from './websocket.js'
import { setupWatcher } from './watcher.js'
import { sessionsRouter } from './api/sessions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function startServer(port: number = 4173) {
  const app = express()
  const server = createServer(app)

  app.use(express.json())

  app.use('/api', sessionsRouter)

  const distDir = join(__dirname, '../dist')
  if (existsSync(distDir)) {
    app.use('/assets', express.static(join(distDir, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }))
    app.use(express.static(distDir, { maxAge: 0 }))
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(distDir, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => {
      res.send(
        '<html><body style="background:#09090b;color:#fafafa;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">' +
          '<div><h1>cc-devtool</h1><p>Run <code>pnpm build</code> first, or use <code>pnpm dev</code> for development.</p></div>' +
          '</body></html>',
      )
    })
  }

  const wss = setupWebSocket(server)
  setupWatcher(wss)

  server.listen(port, () => {
    console.log(`\n  cc-devtool server running at http://localhost:${port}\n`)
  })

  return server
}
