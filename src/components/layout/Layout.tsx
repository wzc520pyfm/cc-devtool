import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useProxyStore } from '../../stores/proxyStore'
import { useSessionStore } from '../../stores/sessionStore'

const navItems = [
  { path: '/', label: 'Sessions', icon: '⊞' },
  { path: '/proxy', label: 'Proxy', icon: '⇌' },
]

export default function Layout() {
  const location = useLocation()
  const { status, fetchStatus } = useProxyStore()
  const setFilters = useSessionStore((s) => s.setFilters)

  useEffect(() => {
    fetchStatus().then(() => {
      const st = useProxyStore.getState().status
      if (st) {
        setFilters({ source: st.dataSourcePreference })
      }
    })
  }, [fetchStatus, setFilters])

  const proxyRunning = status?.running ?? false

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <div
        data-tauri-drag-region
        className="h-[28px] shrink-0 w-full select-none"
      />
      <div className="flex flex-1 min-h-0">
      <aside className="w-56 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-indigo-400">cc</span>-devtool
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">AI Agent Debugger</p>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/session')
              : location.pathname === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
                {item.path === '/proxy' && proxyRunning && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>
        {status && (
          <div className="px-3 py-2 border-t border-zinc-800">
            <DataSourceIndicator preference={status.dataSourcePreference} />
          </div>
        )}
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-600">
          v0.1.0
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      </div>
    </div>
  )
}

const sourceLabels = {
  all: 'All Sources',
  local: 'Local Only',
  proxy: 'Proxy Only',
} as const

function DataSourceIndicator({ preference }: { preference: 'all' | 'local' | 'proxy' }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
      <span className={`w-1.5 h-1.5 rounded-full ${
        preference === 'all' ? 'bg-zinc-500' :
        preference === 'local' ? 'bg-sky-400' :
        'bg-rose-400'
      }`} />
      {sourceLabels[preference]}
    </div>
  )
}
