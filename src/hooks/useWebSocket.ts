import { useEffect, useRef, useCallback } from 'react'

interface WSMessage {
  type: string
  payload: unknown
}

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage
        onMessageRef.current(msg)
      } catch { /* ignore parse errors */ }
    }

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return wsRef
}
