import { watch } from 'chokidar'
import { homedir } from 'os'
import { join } from 'path'
import type { WebSocketServer } from 'ws'
import { broadcast } from './websocket.js'
import { invalidateCache } from './api/sessions.js'

export function setupWatcher(_wss: WebSocketServer) {
  const home = homedir()

  const transcriptPaths = [
    join(home, '.claude', 'projects'),
    join(home, '.cursor', 'projects'),
    join(home, '.codex', 'sessions'),
  ]

  const sqlitePaths = [
    join(home, '.cursor', 'ai-tracking', 'ai-code-tracking.db'),
    join(home, '.codex', 'state_5.sqlite'),
  ]

  const watcher = watch(transcriptPaths, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 6,
  })

  const sqliteWatcher = watch(sqlitePaths, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true,
    interval: 5000,
  })

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const notifyChange = (filePath: string, eventType: string) => {
    if (
      !filePath.endsWith('.jsonl') &&
      !filePath.endsWith('.txt') &&
      !filePath.endsWith('.db') &&
      !filePath.endsWith('.sqlite')
    ) return

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

  sqliteWatcher.on('change', (path) => notifyChange(path, 'db_change'))

  console.log('  Watching for transcript & database changes...')

  return watcher
}
