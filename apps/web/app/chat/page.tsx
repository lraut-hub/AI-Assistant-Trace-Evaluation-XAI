"use client";

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { Send, Loader, ImageIcon, X, ChevronUp } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';

const API_V1 = `${API_BASE}/api/v1`;

function ModeSelector({ currentMode }: { currentMode: 'Standard' | 'Trace' }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  
  return (
    <div style={{ position: 'relative' }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', 
          padding: '4px 8px', background: 'transparent', borderRadius: 'var(--radius-full)', 
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
          transition: 'background var(--transition-fast)' 
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-sidebar-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
      >
        {currentMode} ⌄
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

function TraceNudge() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => setVisible(false), 300);
  };

  const handleUseTrace = () => {
    router.push('/trace');
  };

  if (!visible) return null;

  return (
    <div className={`trace-nudge ${exiting ? 'trace-nudge--exiting' : ''}`} id="trace-nudge">
      <span className="trace-nudge__icon">◇</span>
      <span className="trace-nudge__text">
        Analyzing competitors, markets, products, or strategic decisions? Use Trace for a structured intelligence breakdown and decision support.
      </span>
      <button className="trace-nudge__cta" onClick={handleUseTrace}>
        Use Trace
      </button>
      <button className="trace-nudge__dismiss" onClick={handleDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Image handling state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionId) {
      // Fetch existing session history
      fetch(`${API_V1}/sessions/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.messages) {
            setMessages(data.messages);
          }
        })
        .catch(err => console.error("Failed to load session history", err));
    }
  }, [sessionId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setImageBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !imageBase64) || isGenerating) return;

    const userMessage = input.trim() || (imageBase64 ? "Analyze this image." : "");
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    const payload = { 
      message: userMessage, 
      session_id: sessionId || "chat-session-default",
      image_base64: imageBase64
    };
    
    // Clear image after sending
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const res = await fetch(`${API_V1}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Network error");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) return;

      let assistantResponse = "";
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      // Buffered SSE parser — handles payloads split across TCP chunks
      let lineBuffer = '';
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) lineBuffer += decoder.decode(value, { stream: !streamDone });

        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") {
            setIsGenerating(false);
            done = true;
            break;
          }
          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'token') {
              assistantResponse += data.content;
              setMessages([...newMessages, { role: 'assistant', content: assistantResponse }]);
            }
          } catch (e) {
            console.error("Failed to parse SSE event", e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      setMessages([...newMessages, { role: 'assistant', content: "Error connecting to AI backend." }]);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* Main Area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {isEmpty ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-6)' }}>
            <h1 className="gemini-greeting" style={{ fontWeight: 400, letterSpacing: '-0.02em' }}>
              Your move!
            </h1>
            <TraceNudge />
          </div>
        ) : (
          <div style={{ padding: 'var(--space-6)', maxWidth: '1000px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 'var(--space-4)',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
              }}>
                {m.role === 'assistant' && (
                  <div style={{ flexShrink: 0, marginTop: '4px' }}>
                    <span style={{ fontSize: '20px', color: 'var(--color-accent)' }}>✦</span>
                  </div>
                )}
                <div style={{
                  background: m.role === 'user' ? 'var(--color-user-bubble)' : 'var(--color-ai-bubble)',
                  color: 'var(--color-text-primary)',
                  padding: m.role === 'user' ? 'var(--space-3) var(--space-4)' : 'var(--space-1) 0',
                  borderRadius: m.role === 'user' ? 'var(--radius-xl)' : '0',
                  maxWidth: '85%',
                  lineHeight: 1.6,
                  fontSize: 'var(--font-size-base)'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {isGenerating && messages.length > 0 && messages[messages.length-1].role === 'user' && (
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <div style={{ flexShrink: 0, marginTop: '4px' }}>
                  <span style={{ fontSize: '20px', color: 'var(--color-accent)' }}>✦</span>
                </div>
                <div style={{ color: 'var(--color-text-muted)' }}>
                  <Loader size={20} className="spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area (Bottom) */}
      <div style={{ padding: 'var(--space-6)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {imageBase64 && (
          <div style={{ position: 'relative', alignSelf: 'flex-start', marginBottom: '8px', marginLeft: 'max(0px, calc(50% - 340px))' }}>
            <img 
              src={`data:image/jpeg;base64,${imageBase64}`} 
              alt="Preview" 
              style={{ height: '60px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)' }} 
            />
            <button 
              onClick={() => setImageBase64(null)}
              style={{
                position: 'absolute', top: '-8px', right: '-8px',
                background: 'var(--color-bg-elevated)', border: 'none', borderRadius: '50%',
                padding: '2px', cursor: 'pointer', color: 'var(--color-text-primary)'
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="gemini-input">
          <input 
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className="gemini-input__btn"
            style={{ fontSize: '24px', flexShrink: 0, paddingBottom: '2px', fontWeight: 300, color: 'var(--color-text-secondary)' }}
          >
            +
          </button>
          
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI Assistant"
            disabled={isGenerating}
            style={{ fontSize: '16px' }}
          />
          
          <div className="gemini-input__actions">
            <ModeSelector currentMode="Standard" />
            <button 
              type="button"
              disabled={isGenerating}
              className="gemini-input__btn"
            >
              🎤
            </button>
            {(input.trim() || imageBase64) && !isGenerating && (
              <button 
                type="submit"
                className="gemini-input__btn gemini-input__btn--accent"
                style={{ background: 'var(--color-text-primary)', color: '#131314' }}
              >
                <Send size={16} />
              </button>
            )}
            {isGenerating && (
              <div className="gemini-input__btn" style={{ cursor: 'default' }}>
                <Loader size={16} className="spin" />
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
        Loading Chat...
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
