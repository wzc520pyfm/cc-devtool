import { useEffect } from 'react'
import { useProxyStore } from '../stores/proxyStore'
import ProxyStatusCard from '../components/proxy/ProxyStatusCard'
import ProxyConfig from '../components/proxy/ProxyConfig'
import CaptureStats from '../components/proxy/CaptureStats'
import ProxyUsage from '../components/proxy/ProxyUsage'
import DataSourceSwitch from '../components/proxy/DataSourceSwitch'

export default function ProxyPage() {
  const { fetchStatus } = useProxyStore()

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 p-4">
        <h2 className="text-xl font-semibold">Proxy</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Transparent API proxy for capturing token usage and request data
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <ProxyStatusCard />
        <DataSourceSwitch />
        <div className="grid grid-cols-2 gap-4">
          <ProxyConfig />
          <CaptureStats />
        </div>
        <ProxyUsage />
      </div>
    </div>
  )
}
