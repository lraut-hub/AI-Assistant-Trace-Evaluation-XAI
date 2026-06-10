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
  if (typeof a === 'object' && a !== null) {
    return a.text || a.description || a.assumption || JSON.stringify(a);
  }
  return JSON.stringify(a);
};

// Categorize an assumption into explicit, inferred, or missing
const categorizeAssumption = (a: any): 'explicit' | 'inferred' | 'missing' => {
  if (typeof a === 'object' && a !== null && a.type) {
    const t = String(a.type).toLowerCase();
    if (t.includes('explicit') || t.includes('stated')) return 'explicit';
    if (t.includes('missing') || t.includes('absent') || t.includes('unknown')) return 'missing';
    return 'inferred';
  }
  // Text-based heuristic
  const text = assumptionToString(a).toLowerCase();
  if (text.includes('unknown') || text.includes('missing') || text.includes('not available') || text.includes('no data')) return 'missing';
  if (text.includes('assume') || text.includes('likely') || text.includes('inferred') || text.includes('estimated')) return 'inferred';
  return 'explicit';
};

// Citation popup component
function CitationPopup({ citation, onClose }: { citation: string; onClose: () => void }) {
  const isUrl = citation.startsWith('http://') || citation.startsWith('https://');

  return (
    <div className="citation-popup" onClick={(e) => e.stopPropagation()}>
      <div className="citation-popup__label">Source</div>
      {isUrl ? (
        <a href={citation} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', wordBreak: 'break-all' }}>
          {(() => { try { return new URL(citation).hostname; } catch { return citation; } })()}
        </a>
      ) : (
        <span>{citation}</span>
      )}
    </div>
  );
}

interface DetailPanelProps {
  selectedNode: any;
  onClose: () => void;
  onReviseNode?: (id: string, directive: string) => Promise<void>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function DetailPanel({ selectedNode, onClose, onReviseNode, isCollapsed, onToggleCollapse }: DetailPanelProps) {
  const [isRevising, setIsRevising] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

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

  // Group assumptions by category
  const getGroupedAssumptions = () => {
    if (!selectedNode?.assumptions || selectedNode.assumptions.length === 0) return null;

    const groups: Record<string, any[]> = { explicit: [], inferred: [], missing: [] };
    for (const a of selectedNode.assumptions) {
      const category = categorizeAssumption(a);
      groups[category].push(a);
    }
    return groups;
  };

  const groupedAssumptions = selectedNode ? getGroupedAssumptions() : null;
  const citations = selectedNode?.citations || [];

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

            {/* Assumptions — Categorized */}
            {groupedAssumptions && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  Key Assumptions
                </h4>

                {groupedAssumptions.explicit.length > 0 && (
                  <div className="assumption-section">
                    <div className="assumption-section__badge assumption-section__badge--explicit">
                      ✓ Explicit
                    </div>
                    <ul className="assumption-section__list">
                      {groupedAssumptions.explicit.map((a: any, i: number) => (
                        <li key={`explicit-${i}`}>{assumptionToString(a)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {groupedAssumptions.inferred.length > 0 && (
                  <div className="assumption-section">
                    <div className="assumption-section__badge assumption-section__badge--inferred">
                      ⚡ Inferred
                    </div>
                    <ul className="assumption-section__list">
                      {groupedAssumptions.inferred.map((a: any, i: number) => (
                        <li key={`inferred-${i}`}>{assumptionToString(a)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {groupedAssumptions.missing.length > 0 && (
                  <div className="assumption-section">
                    <div className="assumption-section__badge assumption-section__badge--missing">
                      ⚠ Missing Info
                    </div>
                    <ul className="assumption-section__list">
                      {groupedAssumptions.missing.map((a: any, i: number) => (
                        <li key={`missing-${i}`}>{assumptionToString(a)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Citations with floating popups */}
            {citations.length > 0 && (
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                  Citations & Evidence
                </h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {citations.map((cit: any, i: number) => {
                    const citStr = citationToString(cit);
                    const isUrl = citStr.startsWith('http://') || citStr.startsWith('https://');
                    return (
                      <div key={i} style={{ position: 'relative' }}>
                        <span
                          className="citation-marker"
                          onClick={() => setActiveCitation(activeCitation === i ? null : i)}
                          style={{ cursor: 'pointer', fontSize: 'var(--font-size-xs)', width: 'auto', height: 'auto', padding: '4px 10px', verticalAlign: 'baseline' }}
                        >
                          [{i + 1}] {isUrl
                            ? (() => { try { return new URL(citStr).hostname; } catch { return citStr; } })()
                            : (citStr.length > 30 ? citStr.substring(0, 30) + '...' : citStr)
                          }
                        </span>
                        {activeCitation === i && (
                          <CitationPopup citation={citStr} onClose={() => setActiveCitation(null)} />
                        )}
                      </div>
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
