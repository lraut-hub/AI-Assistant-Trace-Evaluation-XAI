'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_STYLES } from '../lib/traceLayout';

function TraceNodeComponent({ data }: NodeProps) {
  const nodeType = (data?.nodeType as string) || 'analysis';
  const style = NODE_STYLES[nodeType] || NODE_STYLES.analysis;
  const label = data?.label as string;
  const subtitle = data?.subtitle as string;

  return (
    <div
      style={{
        background: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: nodeType === 'gate' ? 4 : 8,
        color: style.color,
        padding: '10px 12px',
        minWidth: 200,
        maxWidth: 220,
        fontSize: 12,
        lineHeight: 1.35,
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: style.border }} />
      <div style={{ fontWeight: 700, marginBottom: subtitle ? 4 : 0 }}>{label}</div>
      {subtitle && (
        <div style={{ fontSize: 10, opacity: 0.92, whiteSpace: 'pre-wrap' }}>{subtitle}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: style.border }} />
    </div>
  );
}

function GateNodeComponent({ data }: NodeProps) {
  const style = NODE_STYLES.gate;
  const label = data?.label as string;
  const subtitle = data?.subtitle as string;

  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <Handle type="target" position={Position.Left} id="left" style={{ top: '50%' }} />
      <div
        style={{
          width: 120,
          height: 120,
          margin: '10px auto',
          background: style.bg,
          border: `2px solid ${style.border}`,
          transform: 'rotate(45deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            transform: 'rotate(-45deg)',
            color: style.color,
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
            padding: 4,
            maxWidth: 90,
          }}
        >
          {label}
        </div>
      </div>
      {subtitle && (
        <div
          style={{
            position: 'absolute',
            bottom: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'var(--color-text-muted)',
            whiteSpace: 'nowrap',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitle}
        </div>
      )}
      <Handle type="source" position={Position.Right} id="yes" style={{ top: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '50%' }} />
    </div>
  );
}

function GroupNodeComponent({ data }: NodeProps) {
  const label = data?.label as string;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(30, 30, 40, 0.55)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        position: 'relative',
      }}
    >
      {label && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export const traceNodeTypes = {
  traceNode: memo(TraceNodeComponent),
  gateNode: memo(GateNodeComponent),
  group: memo(GroupNodeComponent),
};
