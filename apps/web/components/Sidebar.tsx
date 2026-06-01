"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BASE } from '../lib/api';

const API_V1 = `${API_BASE}/api/v1`;

interface Session {
  id: string;
  title: string;
  updated_at: string;
}

export default function Sidebar() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const isTrace = pathname === '/trace';

  useEffect(() => {
    fetch(`${API_V1}/sessions?limit=20`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSessions(data);
        } else {
          setSessions([]);
        }
      })
      .catch(() => setSessions([]));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_V1}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      alert("Document uploaded: " + data.filename);
    } catch {
      alert("Error uploading document.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar__header">
        <button
          className="sidebar__toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          ☰
        </button>
        {!isCollapsed && (
          <div className="sidebar__brand">
            <span className="sidebar__brand-icon">✦</span>
            AI Assistant
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ padding: '0 var(--space-2)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Link href="/chat" className="sidebar__nav-btn">
          <span className="sidebar__nav-icon">✏️</span>
          {!isCollapsed && <span>New chat</span>}
        </Link>
      </div>

      {/* Upload */}
      {!isCollapsed && (
        <div style={{ padding: 'var(--space-2) var(--space-4)', marginTop: 'var(--space-2)' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            style={{ display: 'none' }}
            accept=".pdf,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="sidebar__nav-btn"
            style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}
          >
            <span className="sidebar__nav-icon">📄</span>
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      )}

      {/* Sessions List */}
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 'var(--space-2)' }}>
          <div className="sidebar__section-label">Recents</div>
          <div style={{ padding: '0 var(--space-2)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {sessions.length === 0 ? (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-2) var(--space-4)' }}>
                No recent sessions.
              </p>
            ) : (
              sessions.map(s => (
                <Link key={s.id} href={`/chat?session_id=${s.id}`} className="sidebar__session-item">
                  {s.title}
                </Link>
              ))
            )}
          </div>
        </div>
      )}

    </aside>
  );
}
