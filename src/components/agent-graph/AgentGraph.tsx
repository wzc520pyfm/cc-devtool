import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Session, AgentNode as AgentNodeType } from '@shared/types'

interface Props {
  session: Session
}

export default function AgentGraph({ session }: Props) {
  if (session.agents.length <= 1) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Single agent session — no graph to display
      </div>
    )
  }

  const nodes: Node[] = session.agents.map((agent, index) => ({
    id: agent.id,
    position: {
      x: agent.parentId ? 200 + (index % 3) * 250 : 50,
      y: agent.parentId ? 50 + Math.floor(index / 3) * 120 : 100,
    },
    data: { agent },
    type: 'default',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      background: '#18181b',
      border: `1px solid ${agent.status === 'error' ? '#ef4444' : '#3f3f46'}`,
      borderRadius: '8px',
      padding: '12px',
      color: '#fafafa',
      fontSize: '12px',
      width: 200,
    },
  }))

  const edges: Edge[] = session.agents
    .filter((a) => a.parentId)
    .map((agent) => ({
      id: `${agent.parentId}-${agent.id}`,
      source: agent.parentId!,
      target: agent.id,
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
      animated: agent.status === 'running',
    }))

  for (const node of nodes) {
    const agent = (node.data as { agent: AgentNodeType }).agent
    node.data = {
      label: (
        <div className="text-left">
          <div className="font-semibold text-xs text-zinc-200">{agent.name}</div>
          {agent.description && (
            <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
              {agent.description.slice(0, 60)}
            </div>
          )}
          <div className="flex gap-2 mt-1 text-[10px] text-zinc-500">
            <span>{agent.toolCallCount} tools</span>
            <span>{agent.turnCount} turns</span>
          </div>
          {agent.tokenUsage.totalTokens > 0 && (
            <div className="text-[10px] text-zinc-600 mt-0.5">
              {agent.tokenUsage.totalTokens.toLocaleString()} tokens
            </div>
          )}
        </div>
      ),
    }
  }

  return (
    <div className="h-full min-h-96" style={{ height: 'calc(100vh - 200px)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        attributionPosition="bottom-left"
        style={{ background: '#09090b' }}
      >
        <Background color="#27272a" gap={20} />
        <Controls
          style={{ background: '#18181b', borderColor: '#3f3f46', color: '#fafafa' }}
        />
      </ReactFlow>
    </div>
  )
}
