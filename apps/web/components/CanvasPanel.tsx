'use client';

import React, { useEffect, useMemo, useCallback, Component, type ErrorInfo, type ReactNode } from 'react';
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

// ── Error Boundary ──────────────────────────────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CanvasPanel] ReactFlow rendering error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', background: '#0a0a0f',
          color: 'var(--color-text-muted)', gap: '16px', padding: '24px',
        }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>⚠</div>
          <h3 style={{ color: 'var(--color-text-primary)', margin: 0 }}>Canvas Rendering Error</h3>
          <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
            The trace canvas encountered an error while rendering the graph.
            This usually resolves by retrying.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            style={{
              background: 'var(--color-accent, #8B5CF6)', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Retry Rendering
          </button>
          <details style={{ fontSize: '11px', opacity: 0.5, maxWidth: 400, wordBreak: 'break-all' }}>
            <summary>Error details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{this.state.error?.message}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Inner Canvas (separated so error boundary can re-mount it) ──────────────
function CanvasInner({
  graphData,
  onNodeClick,
}: {
  graphData: any;
  onNodeClick: (node: any) => void;
}) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    try {
      if (!graphData || !graphData.nodes) {
        return { nodes: [] as Node[], edges: [] as Edge[] };
      }
      return graphToFlow(graphData);
    } catch (err) {
      console.error('[CanvasPanel] useMemo graphToFlow error:', err);
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }
  }, [graphData]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const onNodeClickHandler = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('group-')) return;
      const raw = (node.data as any)?.raw;
      if (raw) onNodeClick(raw);
    },
    [onNodeClick]
  );

  if (nodes.length === 0) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0a0a0f', color: 'var(--color-text-muted)',
      }}>
        <p style={{ fontSize: '14px' }}>Waiting for graph data...</p>
      </div>
    );
  }

  return (
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
  );
}

// ── Exported Component ──────────────────────────────────────────────────────
export default function CanvasPanel({
  graphData,
  onNodeClick,
}: {
  graphData: any;
  onNodeClick: (node: any) => void;
}) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0f' }}>
      <CanvasErrorBoundary>
        <CanvasInner graphData={graphData} onNodeClick={onNodeClick} />
      </CanvasErrorBoundary>
    </div>
  );
}

