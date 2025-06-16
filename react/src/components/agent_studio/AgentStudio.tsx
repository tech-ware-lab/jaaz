import React, { useCallback, useEffect, useRef } from 'react'
import { ReactFlow, useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import debounce from 'lodash.debounce'

import '@xyflow/react/dist/style.css'
import HomeHeader from '../home/HomeHeader'
import AgentNode from './AgentNode'

const LOCAL_STORAGE_KEY = 'agent-studio-graph'

const defaultNodes = [
  {
    id: '1',
    type: 'agent',
    position: { x: 0, y: 0 },
    data: { label: '1' },
  },
  {
    id: '2',
    type: 'agent',
    position: { x: 100, y: 100 },
    data: { label: '2' },
  },
]
// const defaultEdges = [{ id: 'e1-2', source: '1', target: '2' }]
const defaultEdges = []

const loadInitialGraph = () => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return [parsed.nodes || defaultNodes, parsed.edges || defaultEdges]
    }
  } catch (e) {
    console.warn('Failed to load saved graph', e)
  }
  return [defaultNodes, defaultEdges]
}

export default function AgentStudio() {
  const [initialNodes, initialEdges] = loadInitialGraph()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const saveGraph = useRef(
    debounce((nodes, edges) => {
      console.log('Saving graph', nodes, edges)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ nodes, edges }))
    }, 500)
  ).current

  useEffect(() => {
    saveGraph(nodes, edges)
  }, [nodes, edges, saveGraph])

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
