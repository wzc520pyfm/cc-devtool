import { Router } from 'express'
import { proxyManager } from '../proxy/manager.js'

export const proxyRouter = Router()

proxyRouter.get('/proxy/status', (_req, res) => {
  res.json(proxyManager.getStatus())
})

proxyRouter.post('/proxy/start', async (req, res) => {
  try {
    if (proxyManager.isRunning()) {
      res.status(409).json({ error: 'Proxy is already running' })
      return
    }
    const overrides = req.body as Record<string, unknown> | undefined
    await proxyManager.start(overrides)
    res.json(proxyManager.getStatus())
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

proxyRouter.post('/proxy/stop', async (_req, res) => {
  try {
    if (!proxyManager.isRunning()) {
      res.status(409).json({ error: 'Proxy is not running' })
      return
    }
    await proxyManager.stop()
    res.json(proxyManager.getStatus())
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

proxyRouter.put('/proxy/config', (req, res) => {
  try {
    const updated = proxyManager.updateConfig(req.body)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})
