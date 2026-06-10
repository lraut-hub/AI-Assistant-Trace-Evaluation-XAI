/**
 * Trace framework layout — columns by stage, parallel rows, gate/stop offsets.
 * Visual style inspired by WiseMapping-style mind maps (horizontal trace flow).
 */

import type { Node, Edge } from '@xyflow/react';

const COL_WIDTH = 300;
const ROW_HEIGHT = 130;
const GROUP_PAD = 24;

const STAGE_COLUMNS: Record<number, { x: number; label: string }> = {
  1: { x: 0, label: 'FRAME' },
  2: { x: 1, label: 'SCAN OUTSIDE' },
  3: { x: 2, label: 'GATE 1' },
  4: { x: 3, label: 'ANALYSE INTERNALS' },
  5: { x: 2, label: 'GATE 2' }, // gate2 shares visual column index — use stage field
  6: { x: 4, label: 'MATCH IDENTITY' },
  7: { x: 5, label: 'FINAL DECISION' },
  8: { x: 6, label: 'REVIEW' },
};

// Map stage number to column index (gate2 is stage 5 but column 3 continued)
function stageToCol(stage: number): number {
  const map: Record<number, number> = {
    1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7,
  };
  return map[stage] ?? 0;
}

const STAGE_LABELS: Record<number, string> = {
  1: 'FRAME',
  2: 'SCAN OUTSIDE',
  3: 'GATE 1',
  4: 'ANALYSE INTERNALS',
  5: 'GATE 2',
  6: 'MATCH IDENTITY',
  7: 'FINAL DECISION',
  8: 'REVIEW',
};

export const NODE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  frame: { bg: '#3B82F6', border: '#1D4ED8', color: '#fff' },
  scan: { bg: '#0D9488', border: '#0F766E', color: '#fff' },
  gate: { bg: '#F59E0B', border: '#B45309', color: '#000' },
  analysis: { bg: '#0D9488', border: '#0F766E', color: '#fff' },
  identity: { bg: '#8B5CF6', border: '#7C3AED', color: '#fff' },
  decision: { bg: '#22C55E', border: '#15803D', color: '#fff' },
  stop: { bg: '#6B7280', border: '#4B5563', color: '#fff' },
  review: { bg: '#4B5563', border: '#374151', color: '#fff' },
};

function statusEmoji(status?: string): string {
  switch (status) {
    case 'green':
    case 'pass':
      return '🟢';
    case 'amber':
      return '🟡';
    case 'red':
      return '🔴';
    case 'pending':
      return '⏳';
    default:
      return '';
  }
}

export function graphToFlow(graphData: {
  nodes: any[];
  edges: any[];
}): { nodes: Node[]; edges: Edge[] } {
  try {
    const rawNodes = graphData?.nodes || [];
    const rawEdges = graphData?.edges || [];

    if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    // Group nodes by stage for row positioning
    const byStage: Record<number, any[]> = {};
    for (const n of rawNodes) {
      if (!n || typeof n !== 'object') continue;
      const st = n.stage ?? 1;
      if (!byStage[st]) byStage[st] = [];
      byStage[st].push(n);
    }
    Object.values(byStage).forEach((arr) =>
      arr.sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
    );

    const flowNodes: Node[] = [];
    const stageBounds: Record<number, { minY: number; maxY: number; col: number }> = {};

    for (let i = 0; i < rawNodes.length; i++) {
      const n = rawNodes[i];
      if (!n || typeof n !== 'object') continue;
      
      // Ensure valid ID
      const nodeId = (typeof n.id === 'string' && n.id.length > 0) ? n.id : `temp-node-${i}`;
      
      const stage = n.stage ?? 1;
      const col = stageToCol(stage);
      const siblings = byStage[stage] || [n];
      const rowIndex = Math.max(0, siblings.findIndex((s) => s.id === n.id));
      const siblingCount = siblings.length;

      let y: number;
      if (n.type === 'stop') {
        y = siblingCount * ROW_HEIGHT + 80;
      } else {
        const centerOffset = ((siblingCount - 1) * ROW_HEIGHT) / 2;
        y = rowIndex * ROW_HEIGHT - centerOffset + 120;
      }

      const x = col * COL_WIDTH + 80;
      stageBounds[stage] = {
        col,
        minY: Math.min(stageBounds[stage]?.minY ?? y, y),
        maxY: Math.max(stageBounds[stage]?.maxY ?? y, y),
      };

      const isGate = n.type === 'gate';
      const emoji = statusEmoji(n.status);
      const subtitle = n.insight ? `\n${emoji} ${n.insight}`.trim() : '';

      flowNodes.push({
        id: nodeId,
        type: isGate ? 'gateNode' : 'traceNode',
        position: { x, y },
        data: {
          raw: n,
          label: (typeof n.label === 'string' ? n.label : '') || 'Thinking...',
          subtitle,
          nodeType: n.type || 'analysis',
          status: n.status,
        },
        style: isGate
          ? undefined
          : {
              width: 220,
              padding: 0,
              border: 'none',
              background: 'transparent',
            },
      });
    }

    // Stage group backgrounds
    const stages = Object.keys(byStage).map(Number).sort((a, b) => a - b);
    for (const stage of stages) {
      const col = stageToCol(stage);
      const siblings = byStage[stage];
      const count = siblings.length;
      const height = Math.max(count * ROW_HEIGHT + 80, 160);
      const width = 250;

      flowNodes.unshift({
        id: `group-stage-${stage}`,
        type: 'group',
        position: { x: col * COL_WIDTH + 40, y: 40 },
        style: {
          width,
          height,
          zIndex: -1,
        },
        data: { label: STAGE_LABELS[stage] || `STAGE ${stage}` },
        draggable: false,
        selectable: false,
      });
    }

    const validNodeIds = new Set(flowNodes.map(n => n.id));

    const flowEdges: Edge[] = (Array.isArray(rawEdges) ? rawEdges : [])
      .filter((e: any) => e && typeof e === 'object' && typeof e.source === 'string' && typeof e.target === 'string' && validNodeIds.has(e.source) && validNodeIds.has(e.target))
      .map((e: any, i: number) => ({
        id: e.id || `temp-edge-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        sourceHandle: e.branch === 'no' ? 'no' : e.branch === 'yes' ? 'yes' : undefined,
        label: e.label || (e.branch === 'yes' ? 'Yes' : e.branch === 'no' ? 'No' : ''),
        animated: e.branch === 'yes',
        style: {
          stroke: e.branch === 'no' ? '#9CA3AF' : e.style === 'dashed' ? '#A78BFA' : '#60A5FA',
          strokeWidth: 2,
          strokeDasharray: e.style === 'dashed' ? '6 4' : undefined,
        },
        labelStyle: { fill: '#e5e7eb', fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.9 },
      }));

    return { nodes: flowNodes, edges: flowEdges };
  } catch (err) {
    console.error('[graphToFlow] Failed to convert graph data to ReactFlow format:', err);
    return { nodes: [], edges: [] };
  }
}
