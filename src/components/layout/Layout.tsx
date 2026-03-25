import { Outlet, Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Sessions', icon: '⊞' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="w-56 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-indigo-400">cc</span>-devtool
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">AI Agent Debugger</p>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                location.pathname === item.path
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-600">
          v0.1.0
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
