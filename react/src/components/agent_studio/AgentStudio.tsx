import React, { useCallback } from 'react'
import { ReactFlow, useNodesState, useEdgesState, addEdge } from '@xyflow/react'

import '@xyflow/react/dist/style.css'
import HomeHeader from '../home/HomeHeader'
import AgentNode from './AgentNode'

const initialNodes = [
  {
    id: '1',
    type: 'agent',
    position: { x: 0, y: 0 },
    data: { label: '1' },
  },
  {
    id: '2',
    type: 'agent',
    position: { x: 0, y: 100 },
    data: { label: '2' },
  },
]
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }]

export default function AgentStudio() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const nodeTypes = {
    agent: AgentNode,
  }

  return (
    <div>
      <HomeHeader />
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
        />
      </div>
    </div>
  )
}
