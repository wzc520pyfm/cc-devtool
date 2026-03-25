import type { Session, FileOp } from '@shared/types'

interface Props {
  session: Session
}

export default function FileImpactView({ session }: Props) {
  const { fileOps } = session

  if (fileOps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        No file operations recorded
      </div>
    )
  }

  const fileMap = new Map<string, FileOp[]>()
  for (const op of fileOps) {
    const existing = fileMap.get(op.path) ?? []
    existing.push(op)
    fileMap.set(op.path, existing)
  }

  const readFiles = [...fileMap.entries()]
    .filter(([, ops]) => ops.every((op) => op.type === 'read'))
    .sort((a, b) => b[1].length - a[1].length)

  const writtenFiles = [...fileMap.entries()]
    .filter(([, ops]) => ops.some((op) => op.type !== 'read'))
    .sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <span className="text-blue-400">📖</span>
            Files Read
            <span className="text-xs text-zinc-600 font-normal">({readFiles.length})</span>
          </h3>
          <div className="space-y-1">
            {readFiles.map(([path, ops]) => (
              <FileItem key={path} path={path} ops={ops} variant="read" />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <span className="text-green-400">✏️</span>
            Files Created / Modified
            <span className="text-xs text-zinc-600 font-normal">({writtenFiles.length})</span>
          </h3>
          <div className="space-y-1">
            {writtenFiles.map(([path, ops]) => (
              <FileItem key={path} path={path} ops={ops} variant="write" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FileItem({
  path,
  ops,
  variant,
}: {
  path: string
  ops: FileOp[]
  variant: 'read' | 'write'
}) {
  const parts = path.split('/')
  const fileName = parts.pop() ?? path
  const dir = parts.join('/')

  const opTypes = [...new Set(ops.map((o) => o.type))]
  const opLabels: Record<string, string> = {
    read: 'R',
    create: 'C',
    update: 'U',
    delete: 'D',
  }
  const opColors: Record<string, string> = {
    read: 'text-blue-400 bg-blue-500/10',
    create: 'text-green-400 bg-green-500/10',
    update: 'text-amber-400 bg-amber-500/10',
    delete: 'text-red-400 bg-red-500/10',
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 group text-xs">
      <div className="flex gap-0.5">
        {opTypes.map((t) => (
          <span key={t} className={`px-1 py-0.5 rounded text-[10px] font-mono ${opColors[t] ?? ''}`}>
            {opLabels[t] ?? t}
          </span>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-zinc-300 font-medium">{fileName}</span>
        {dir && <span className="text-zinc-600 ml-1 truncate">{dir}</span>}
      </div>
      <span className="text-zinc-600 shrink-0">{ops.length}×</span>
    </div>
  )
}
