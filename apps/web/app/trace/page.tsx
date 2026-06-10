"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Send, Loader, Sparkles, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CanvasPanel from '../../components/CanvasPanel';
import DetailPanel from '../../components/DetailPanel';
import { API_BASE } from '../../lib/api';

const API_V1 = `${API_BASE}/api/v1`;

const SUGGESTIONS = [
  "Should we pivot our SaaS pricing from per-seat to usage-based?",
  "Evaluate entering the EV charging market in Tier-2 Indian cities",
];

// ── Progress phases for the progressive analysis overlay ──
const ANALYSIS_PHASES = [
  { label: 'Understanding Problem', threshold: 0 },
  { label: 'Building Assumptions', threshold: 15 },
  { label: 'Gathering Evidence', threshold: 30 },
  { label: 'Performing Analysis', threshold: 50 },
  { label: 'Constructing Decision Framework', threshold: 70 },
  { label: 'Generating Final Recommendation', threshold: 85 },
];

function getPhaseForProgress(progress: number): string {
  let phase = ANALYSIS_PHASES[0].label;
  for (const p of ANALYSIS_PHASES) {
    if (progress >= p.threshold) phase = p.label;
  }
  return phase;
}

// ── Markdown to HTML with citation marker support ──
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\\> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    // Citation markers: [1], [2] etc. → clickable superscript spans
    .replace(/\[(\d+)\]/g, '<span class="citation-marker" data-cite="$1" title="Citation $1">$1</span>');
}

// ── Progress Overlay Component ──
function ProgressOverlay({ progress, isCompleting }: { progress: number; isCompleting: boolean }) {
  const phase = getPhaseForProgress(progress);

  return (
    <div className={`progress-overlay ${isCompleting ? 'progress-overlay--completing' : ''}`}>
      <div className="progress-overlay__container">
        <div className="progress-overlay__percentage">{Math.round(progress)}%</div>
        <div className="progress-overlay__bar-track">
          <div
            className="progress-overlay__bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-overlay__phase">
          <div className="progress-overlay__phase-dot" />
          {phase}
        </div>
      </div>
    </div>
  );
}

// ── Evaluation History Tab ──
interface EvalSession {
  id: string;
  title: string;
  graphData: any;
  chatHistory: Array<{role: string, content: string, isAnalysis?: boolean}>;
}

function EvalHistoryBar({
  sessions,
  activeId,
  onSwitch,
}: {
  sessions: EvalSession[];
  activeId: string;
  onSwitch: (id: string) => void;
}) {
  if (sessions.length <= 1) return null;

  return (
    <div className="eval-history" id="eval-history-bar">
      {sessions.map((s) => (
        <button
          key={s.id}
          className={`eval-history__pill ${s.id === activeId ? 'eval-history__pill--active' : ''}`}
          onClick={() => onSwitch(s.id)}
        >
          {s.id === activeId && <span className="eval-history__pill-dot" />}
          {s.title}
        </button>
      ))}
    </div>
  );
}

function ModeSelector({ currentMode }: { currentMode: 'Standard' | 'Trace' }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  
  return (
    <div style={{ position: 'relative' }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', 
          padding: '4px 8px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-full)', 
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
          transition: 'background var(--transition-fast)' 
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-sidebar-hover)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-bg-elevated)'}
      >
        {currentMode} <ChevronUp size={12} />
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '110%', left: 0, 
          background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-sm)', padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '120px'
        }}>
          <button 
            type="button"
            onClick={() => { setIsOpen(false); if (currentMode !== 'Standard') router.push('/chat'); }}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--color-text-primary)', 
              padding: '8px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer', fontSize: 'var(--font-size-xs)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-sidebar-hover)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            💬 Standard
          </button>
          <button 
            type="button"
            onClick={() => { setIsOpen(false); if (currentMode !== 'Trace') router.push('/trace'); }}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--color-text-primary)', 
              padding: '8px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer', fontSize: 'var(--font-size-xs)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--color-sidebar-hover)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            ◇ Trace
          </button>
        </div>
      )}
    </div>
  );
}

export default function TracePage() {
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [graphData, setGraphData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false);
  
  // Left chat panel state
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string, isAnalysis?: boolean}>>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  
  // Progressive analysis state
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isProgressCompleting, setIsProgressCompleting] = useState(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Evaluation history state
  const [evalSessions, setEvalSessions] = useState<EvalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, statusText, isAnalysisLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedNode) setSelectedNode(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  // Clean up progress timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // ── Start synthetic progress simulation ──
  const startProgressSimulation = useCallback(() => {
    setAnalysisProgress(0);
    setIsProgressCompleting(false);

    let current = 0;
    progressTimerRef.current = setInterval(() => {
      // Slow down as we approach 90% (never reach 100% until real completion)
      const remaining = 90 - current;
      const increment = Math.max(0.3, remaining * 0.04);
      current = Math.min(90, current + increment);
      setAnalysisProgress(current);
    }, 200);
  }, []);

  const completeProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setAnalysisProgress(100);
    setIsProgressCompleting(true);
    // Remove the overlay after the fade-out animation
    setTimeout(() => {
      setIsProgressCompleting(false);
      setAnalysisProgress(0);
    }, 1200);
  }, []);

  // ── Classify query as follow_up or new_topic ──
  const classifyQuery = useCallback(async (query: string): Promise<'follow_up' | 'new_topic'> => {
    if (chatHistory.length === 0) return 'new_topic';
    
    try {
      const res = await fetch(`${API_V1}/eval/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          conversation_history: chatHistory.map(m => ({ role: m.role, content: m.content.substring(0, 200) })),
        }),
      });
      if (!res.ok) return 'new_topic';
      const data = await res.json();
      return data.type === 'follow_up' ? 'follow_up' : 'new_topic';
    } catch {
      return 'new_topic';
    }
  }, [chatHistory]);

  // ── Save current session to history ──
  const saveCurrentSession = useCallback(() => {
    if (!graphData || chatHistory.length === 0) return;

    const userMessages = chatHistory.filter(m => m.role === 'user');
    const title = userMessages[0]?.content?.substring(0, 40) + '...' || 'Evaluation';
    const sessionId = activeSessionId || `eval-${Date.now()}`;

    setEvalSessions(prev => {
      const existing = prev.findIndex(s => s.id === sessionId);
      const session: EvalSession = { id: sessionId, title, graphData, chatHistory };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = session;
        return updated;
      }
      return [...prev, session];
    });

    return sessionId;
  }, [graphData, chatHistory, activeSessionId]);

  // ── Switch between evaluation sessions ──
  const switchToSession = useCallback((sessionId: string) => {
    const session = evalSessions.find(s => s.id === sessionId);
    if (!session) return;

    // Save current before switching
    saveCurrentSession();

    setGraphData(session.graphData);
    setChatHistory(session.chatHistory);
    setActiveSessionId(sessionId);
    setSelectedNode(null);
  }, [evalSessions, saveCurrentSession]);

  const handleSubmit = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const query = overrideQuery || input.trim();
    if (!query || isGenerating) return;

    // Classify the query
    const queryType = await classifyQuery(query);

    if (queryType === 'new_topic' && graphData) {
      // Save current evaluation to history before starting new one
      const savedId = saveCurrentSession();
      
      // Start fresh
      const newId = `eval-${Date.now()}`;
      setActiveSessionId(newId);
      setChatHistory([{ role: 'user', content: query }]);
      setGraphData(null);
      setSelectedNode(null);
    } else {
      // Follow-up: keep existing canvas and chat
      setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    }

    setInput('');
    setIsGenerating(true);
    if (queryType === 'new_topic') {
      setGraphData(null);
      setSelectedNode(null);
    }
    setStatusText('Framing decision...');

    // Start progressive analysis overlay
    startProgressSimulation();

    try {
      const res = await fetch(`${API_V1}/trace/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, session_id: activeSessionId || "trace-session-1" }),
      });

      if (!res.ok) throw new Error("Network error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) return;

      // Buffer incomplete lines across TCP chunks
      let lineBuffer = '';
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) lineBuffer += decoder.decode(value, { stream: !streamDone });

        // Process all complete lines in the buffer
        const lines = lineBuffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") {
            setIsGenerating(false);
            setStatusText('');
            completeProgress();
            setChatHistory(prev => [...prev, { role: 'assistant', content: 'Trace generation complete. Explore the canvas or request a Full Analysis.' }]);
            done = true;
            break;
          }
          try {
            const data = JSON.parse(dataStr);
            if (data.status === 'planning') {
              setStatusText('Scanning outside + building gates...');
              setAnalysisProgress(prev => Math.max(prev, 20));
            }
            if (data.status === 'reasoning') {
              setStatusText('Tracing internals and identity paths...');
              setAnalysisProgress(prev => Math.max(prev, 55));
            }
            if (data.graph) {
              setGraphData(data.graph);
              setAnalysisProgress(prev => Math.max(prev, 80));
            }
            if (data.type === 'error') {
              setStatusText(data.message || 'Trace generation failed.');
              setIsGenerating(false);
              completeProgress();
            }
          } catch {
            /* skip malformed/partial SSE line */
          }
        }
      }
    } catch (err) {
      console.error(err);
      setStatusText('Error connecting to Trace backend.');
      completeProgress();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSubmit(undefined, suggestion);
  };

  const handleReviseNode = async (nodeId: string, directive: string) => {
    if (!graphData) return;
    const res = await fetch(`${API_V1}/trace/node/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input, // Need last query? Usually we can just pass the context
        session_id: activeSessionId || "trace-session-1",
        graph: graphData,
        node_id: nodeId,
        directive,
      }),
    });
    if (!res.ok) throw new Error("Revise failed");
    const data = await res.json();
    if (data.status === "success" && data.node) {
      const updatedGraph = {
        ...graphData,
        nodes: graphData.nodes.map((n: any) => (n.id === nodeId ? data.node : n)),
      };
      setGraphData(updatedGraph);
      if (selectedNode?.id === nodeId) setSelectedNode(data.node);
    }
  };

  const handleFullAnalysis = useCallback(async () => {
    if (!graphData) return;
    
    // Add user request to chat
    const lastUserQuery = chatHistory.filter(m => m.role === 'user').pop()?.content || 'Generate Full Analysis';
    
    setIsAnalysisLoading(true);
    try {
      const res = await fetch(`${API_V1}/trace/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: lastUserQuery, graph: graphData }),
      });
      if (!res.ok) throw new Error("Report generation failed");
      const data = await res.json();
      
      const analysisHtml = markdownToHtml(data.report);
      setChatHistory(prev => [...prev, { role: 'assistant', content: analysisHtml, isAnalysis: true }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: '<p style="color: var(--color-error);">Failed to generate analysis report.</p>', isAnalysis: true }]);
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [graphData, chatHistory]);

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', flexDirection: 'column' }}>

      {/* Evaluation History Bar */}
      <EvalHistoryBar sessions={evalSessions} activeId={activeSessionId} onSwitch={switchToSession} />
      
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      
      {/* 1. Left Chat Window */}
      <div style={{
        width: isChatCollapsed ? '0' : '400px',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-primary)',
        borderRight: '1px solid var(--color-border-subtle)',
        transition: 'width var(--transition-panel)',
        overflow: 'hidden',
        flexShrink: 0
      }}>
        
        {/* Chat History / Body */}
        <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {chatHistory.length === 0 && !isGenerating && (
            <div style={{ marginTop: 'auto', marginBottom: 'auto', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.8 }}>◇</div>
              <h2 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-6)' }}>What would you like to evaluate?</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {SUGGESTIONS.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    style={{
                      background: 'var(--color-suggestion-bg)',
                      border: '1px solid var(--color-suggestion-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3) var(--space-4)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-secondary)',
                      textAlign: 'left'
                    }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {chatHistory.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 'var(--space-3)',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
            }}>
              {m.role === 'assistant' && (
                <div style={{ flexShrink: 0, marginTop: '4px' }}>
                  <span style={{ fontSize: '18px', color: 'var(--color-accent)' }}>✦</span>
                </div>
              )}
              <div style={{
                background: m.role === 'user' ? 'var(--color-user-bubble)' : (m.isAnalysis ? 'var(--color-bg-surface)' : 'transparent'),
                color: 'var(--color-text-primary)',
                padding: m.role === 'user' || m.isAnalysis ? 'var(--space-3) var(--space-4)' : 'var(--space-1) 0',
                borderRadius: m.role === 'user' ? 'var(--radius-xl)' : (m.isAnalysis ? 'var(--radius-md)' : '0'),
                border: m.isAnalysis ? '1px solid var(--color-border-subtle)' : 'none',
                maxWidth: '90%',
                lineHeight: 1.6,
                fontSize: 'var(--font-size-sm)'
              }}>
                {m.isAnalysis ? (
                  <div className="analysis-content" dangerouslySetInnerHTML={{ __html: m.content }} />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                )}
                
                {/* Append Full Analysis button after the initial trace complete message */}
                {m.role === 'assistant' && !m.isAnalysis && graphData && i === chatHistory.length - 1 && (
                  <button
                    onClick={handleFullAnalysis}
                    disabled={isAnalysisLoading}
                    style={{
                      marginTop: '12px',
                      background: 'var(--color-accent)',
                      color: '#131314',
                      border: 'none',
                      borderRadius: 'var(--radius-input)',
                      padding: '6px 14px',
                      cursor: isAnalysisLoading ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      opacity: isAnalysisLoading ? 0.7 : 1,
                    }}
                  >
                    {isAnalysisLoading ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                    {isAnalysisLoading ? 'Thinking...' : 'Full Analysis'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {isGenerating && statusText && (
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flexShrink: 0, marginTop: '4px' }}>
                <span style={{ fontSize: '18px', color: 'var(--color-accent)' }}>✦</span>
              </div>
              <div className="pulse-glow" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic', padding: 'var(--space-1) 0' }}>
                {statusText}
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <form onSubmit={handleSubmit} className="gemini-input" style={{ maxWidth: '100%' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '18px', flexShrink: 0 }}>+</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Refine evaluation..."
              disabled={isGenerating}
              style={{ fontSize: 'var(--font-size-sm)' }}
            />
            <div className="gemini-input__actions">
              <ModeSelector currentMode="Trace" />
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="gemini-input__btn"
                style={{
                  opacity: input.trim() && !isGenerating ? 1 : 0.4,
                  cursor: input.trim() && !isGenerating ? 'pointer' : 'default'
                }}
              >
                {isGenerating ? <Loader size={16} className="spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 2. Center Canvas */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0a0a0f' }}>
        
        {/* Mobile toggle / collapse left chat */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsChatCollapsed(!isChatCollapsed)}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
            title={isChatCollapsed ? "Show chat" : "Hide chat"}
          >
            {isChatCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        {/* Detail Panel Toggle (Right) — rendered on the left edge of the panel */}
        {graphData && isDetailCollapsed && (
          <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', zIndex: 10 }}>
            <button
              onClick={() => setIsDetailCollapsed(false)}
              style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRight: 'none',
                borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                padding: '12px 5px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Show details"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}

        {/* Progressive Analysis Overlay */}
        {(isGenerating || isProgressCompleting) && graphData && (
          <ProgressOverlay progress={analysisProgress} isCompleting={isProgressCompleting} />
        )}

        {graphData ? (
          <CanvasPanel graphData={graphData} onNodeClick={(n) => { setSelectedNode(n); setIsDetailCollapsed(false); }} />
        ) : isGenerating ? (
          /* Show progress overlay even before graph data arrives */
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <ProgressOverlay progress={analysisProgress} isCompleting={false} />
          </div>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--color-accent)', opacity: 0.1 }}>◇</div>
              <h2 style={{ color: 'var(--color-text-primary)', marginBottom: '8px' }}>Canvas View</h2>
              <p style={{ fontSize: 'var(--font-size-sm)' }}>Your reasoning trace will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Detail Panel */}
      {graphData && (
        <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
          {/* Single collapse/expand tab on the left edge of the panel */}
          {!isDetailCollapsed && (
            <button
              onClick={() => setIsDetailCollapsed(true)}
              style={{
                position: 'absolute',
                left: -20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRight: 'none',
                borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                padding: '12px 4px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '-2px 0 6px rgba(0,0,0,0.2)',
              }}
              title="Collapse panel"
            >
              <ChevronRight size={16} />
            </button>
          )}
          <DetailPanel
            selectedNode={selectedNode}
            onClose={() => setSelectedNode(null)}
            onReviseNode={handleReviseNode}
            isCollapsed={isDetailCollapsed}
            onToggleCollapse={() => setIsDetailCollapsed(!isDetailCollapsed)}
          />
        </div>
      )}
      </div>
    </div>
  );
}
