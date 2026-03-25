import { watch } from 'chokidar'
import { homedir } from 'os'
import { join } from 'path'
import type { WebSocketServer } from 'ws'
import { broadcast } from './websocket.js'
import { invalidateCache } from './api/sessions.js'

export function setupWatcher(_wss: WebSocketServer) {
  const home = homedir()

  const watchPaths = [
    join(home, '.claude', 'projects'),
    join(home, '.cursor', 'projects'),
    join(home, '.codex', 'sessions'),
  ]

  const watcher = watch(watchPaths, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 6,
  })

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const notifyChange = (filePath: string, eventType: string) => {
    if (!filePath.endsWith('.jsonl') && !filePath.endsWith('.txt')) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      invalidateCache()
      broadcast({
        type: 'session_update',
        payload: {
          file: filePath,
          event: eventType,
          timestamp: Date.now(),
        },
      })
    }, 500)
  }

  watcher.on('add', (path) => notifyChange(path, 'add'))
  watcher.on('change', (path) => notifyChange(path, 'change'))

  console.log('  Watching for transcript changes...')

  return watcher
}
