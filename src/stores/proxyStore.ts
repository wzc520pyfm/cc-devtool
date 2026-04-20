import { create } from 'zustand'
import { api } from '../lib/api'
import type { ProxyStatus, ProxyConfig } from '../lib/api'

interface ProxyStore {
  status: ProxyStatus | null
  loading: boolean
  error: string | null
  fetchStatus: () => Promise<void>
  startProxy: (config?: ProxyConfig) => Promise<void>
  stopProxy: () => Promise<void>
  restartProxy: (config?: ProxyConfig) => Promise<void>
  updateConfig: (config: ProxyConfig) => Promise<void>
}

export const useProxyStore = create<ProxyStore>((set) => ({
  status: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const status = await api.getProxyStatus()
      set({ status, error: null })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  startProxy: async (config) => {
    set({ loading: true, error: null })
    try {
      const status = await api.startProxy(config)
      set({ status, loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  stopProxy: async () => {
    set({ loading: true, error: null })
    try {
      const status = await api.stopProxy()
      set({ status, loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  restartProxy: async (config) => {
    set({ loading: true, error: null })
    try {
      const status = await api.restartProxy(config)
      set({ status, loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  updateConfig: async (config) => {
    set({ loading: true, error: null })
    try {
      await api.updateProxyConfig(config)
      const status = await api.getProxyStatus()
      set({ status, loading: false })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },
}))
