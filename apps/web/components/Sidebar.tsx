"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_BASE } from '../lib/api';

const API_V1 = `${API_BASE}/api/v1`;

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar__header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? 'var(--space-4) 0' : 'var(--space-4)' }}>
        {!isCollapsed && (
          <div className="sidebar__brand" style={{ fontSize: '1.25rem' }}>
            <span className="sidebar__brand-icon" style={{ 
              background: 'linear-gradient(135deg, #4285f4, #ea4335, #fbbc04, #34a853)', 
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontSize: '24px'
            }}>✦</span>
            AI Assistant
          </div>
        )}
        <button
          className="sidebar__toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '☰' : '◫'}
        </button>
      </div>

      {/* New Chat */}
      <div style={{ padding: '0 var(--space-3)', marginTop: '4px' }}>
        <Link href="/chat" className="sidebar__nav-btn" style={{ 
          background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-full)', 
          justifyContent: isCollapsed ? 'center' : 'space-between', padding: '10px 14px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="sidebar__nav-icon" style={{ fontSize: '18px' }}>+</span>
            {!isCollapsed && <span style={{ fontWeight: 500 }}>New chat</span>}
          </div>
          {!isCollapsed && <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Ctrl+Shift+O</span>}
        </Link>
      </div>

    </aside>
  );
}
