import React, { useState } from 'react';
import { Loader } from 'lucide-react';

// Helper to safely render explanation with line breaks
const renderExplanation = (exp: any): string => {
  if (!exp) return '';
  if (typeof exp === 'string') {
    return exp.replace(/\n/g, '<br/>');
  }
  if (Array.isArray(exp)) {
    return exp
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join('<br/>');
  }
  return JSON.stringify(exp);
};

// Safely coerce a citation item to string
const citationToString = (cit: any): string => {
  if (typeof cit === 'string') return cit;
  if (typeof cit === 'object' && cit !== null) {
    return cit.url || cit.title || cit.source || JSON.stringify(cit);
  }
  return String(cit);
};

// Safely coerce an assumption item to string
const assumptionToString = (a: any): string => {
  if (typeof a === 'string') return a;
  return JSON.stringify(a);
};

interface DetailPanelProps {
  selectedNode: any;
  onClose: () => void;
  onReviseNode?: (id: string, directive: string) => Promise<void>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function DetailPanel({ selectedNode, onClose, onReviseNode, isCollapsed, onToggleCollapse }: DetailPanelProps) {
  const [isRevising, setIsRevising] = useState(false);

  const handleRevise = async (directive: string) => {
    if (!onReviseNode || !selectedNode) return;
    setIsRevising(true);
    try {
      await onReviseNode(selectedNode.id, directive);
    } catch (e) {
      console.error(e);
      alert("Failed to revise node");
    } finally {
      setIsRevising(false);
    }
  };

  return (
    <div className={`detail-panel ${isCollapsed ? 'detail-panel--collapsed' : ''}`}>
      <div style={{ height: '100%', overflowY: 'auto', padding: 'var(--space-6)', position: 'relative' }}>
        {isRevising && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
          }}>
            <Loader size={32} className="spin" color="var(--color-accent)" />
            <p style={{ marginTop: '16px', fontWeight: 'bold' }}>Agent revising node...</p>
          </div>
        )}

        {!selectedNode ? (
          <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>◇</div>
            Select a node to view detailed reasoning.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{
                margin: 0, color: 'var(--color-accent)',
                textTransform: 'uppercase', fontSize: 'var(--font-size-xs)',
                letterSpacing: '0.05em', fontWeight: 600
              }}>
                {selectedNode.trace_stage ? selectedNode.trace_stage.replace(/_/g, ' ') : selectedNode.type}
              </h3>
              <button onClick={onClose} style={{
                background: 'transparent', border: 'none',
                color: 'var(--color-text-muted)', cursor: 'pointer',
                fontSize: '16px', padding: '4px'
              }}>
                ✕
              </button>
            </div>

            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
              {selectedNode.label}
            </h2>

            <p style={{
              color: 'var(--color-text-secondary)', fontStyle: 'italic',
              marginBottom: 'var(--space-6)',
              borderLeft: '2px solid var(--color-accent)',
              paddingLeft: 'var(--space-3)',
              fontSize: 'var(--font-size-sm)'
            }}>
              {selectedNode.insight}
            </p>

            {/* Agentic Actions */}
            <div style={{ marginBottom: 'var(--space-6)', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRevise("Expand on this reasoning, making it more comprehensive and detailed.")}
                style={{
                  flex: 1, padding: '8px 12px',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
                  transition: 'all var(--transition-fast)'
                }}
              >
                ✨ Expand
              </button>
              <button
                onClick={() => handleRevise("Challenge the core assumptions here. Provide a contrarian perspective.")}
                style={{
                  flex: 1, padding: '8px 12px',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)',
                  transition: 'all var(--transition-fast)'
                }}
              >
                🤺 Challenge
              </button>
            </div>

            {/* Explanation */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                Detailed Explanation
              </h4>
              <div style={{ lineHeight: 1.7, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {selectedNode.explanation ? (
                  <div dangerouslySetInnerHTML={{ __html: renderExplanation(selectedNode.explanation) }} />
                ) : (
                  <span style={{ opacity: 0.5 }}>Reasoning engine is currently elaborating on this node...</span>
                )}
              </div>
            </div>

            {/* Assumptions */}
            {selectedNode.assumptions && selectedNode.assumptions.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  Key Assumptions
                </h4>
                <ul style={{ paddingLeft: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  {selectedNode.assumptions.map((ass: any, i: number) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{assumptionToString(ass)}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Citations */}
            {selectedNode.citations && selectedNode.citations.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  Citations & Evidence
                </h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedNode.citations.map((cit: any, i: number) => {
                    const citStr = citationToString(cit);
                    const isUrl = citStr.startsWith('http://') || citStr.startsWith('https://');
                    return isUrl ? (
                      <a key={i} href={citStr} target="_blank" rel="noopener noreferrer" style={{
                        background: 'var(--color-bg-elevated)', padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-accent)', textDecoration: 'none',
                        border: '1px solid var(--color-border-subtle)'
                      }}>
                        🔗 {(() => { try { return new URL(citStr).hostname; } catch { return citStr; } })()}
                      </a>
                    ) : (
                      <span key={i} style={{
                        background: 'var(--color-bg-elevated)', padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--color-border-subtle)'
                      }}>
                        📄 {citStr}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
