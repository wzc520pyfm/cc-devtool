import express from 'express'
import { createServer } from 'http'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { setupWebSocket } from './websocket.js'
import { setupWatcher } from './watcher.js'
import { sessionsRouter } from './api/sessions.js'
import { proxyRouter } from './api/proxy.js'
import { proxyManager } from './proxy/manager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolvePublicDir(): string | null {
  const candidates = [
    join(__dirname, '../public'),      // compiled: dist/server/ -> dist/public/
    join(__dirname, '../dist/public'), // dev (tsx): server/ -> dist/public/
    join(__dirname, '../dist'),        // legacy: server/ -> dist/
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir
  }
  return null
}

export async function startServer(port: number = 4173) {
  const app = express()
  const server = createServer(app)

  app.use(express.json())

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  app.use('/api', sessionsRouter)
  app.use('/api', proxyRouter)

  const publicDir = resolvePublicDir()
  if (publicDir) {
    app.use('/assets', express.static(join(publicDir, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }))
    app.use(express.static(publicDir, { maxAge: 0 }))
    app.get('/{*path}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(publicDir, 'index.html'))
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

  await proxyManager.autoStartIfConfigured()

  return server
}
