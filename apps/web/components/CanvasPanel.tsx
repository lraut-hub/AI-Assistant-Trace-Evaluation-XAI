'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphToFlow } from '../lib/traceLayout';
import { traceNodeTypes } from './traceNodes';

export default function CanvasPanel({
  graphData,
  onNodeClick,
}: {
  graphData: any;
  onNodeClick: (node: any) => void;
}) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => graphToFlow(graphData),
    [graphData]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const onNodeClickHandler = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('group-')) return;
      const raw = node.data?.raw;
      if (raw) onNodeClick(raw);
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0f' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={traceNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const t = (n.data as any)?.nodeType;
            if (t === 'gate') return '#F59E0B';
            if (t === 'decision') return '#22C55E';
            if (t === 'identity') return '#8B5CF6';
            if (t === 'stop') return '#6B7280';
            return '#0D9488';
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
        <Background gap={20} size={1} color="rgba(255,255,255,0.06)" />
      </ReactFlow>
    </div>
  );
}
