import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

let wss: WebSocketServer | null = null

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', payload: { timestamp: Date.now() } }))
  })

  return wss
}

export function broadcast(message: { type: string; payload: unknown }) {
  if (!wss) return
  const data = JSON.stringify(message)
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  }
}
