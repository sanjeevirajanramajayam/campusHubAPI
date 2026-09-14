'use client';

import React, { useState } from 'react';
import { User, Ticket, apiRequest, formatUserCallsign } from '@/lib/api';

interface AuthSidebarProps {
  currentUser: User | null;
  userTickets: Ticket[];
  onOpenProfile: () => void;
  onLogout: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  onOpenCreatePost: () => void;
  onViewEvents: () => void;
}

export function AuthSidebar({
  currentUser,
  userTickets,
  onOpenProfile,
  onLogout,
  onLoginSuccess,
  onOpenCreatePost,
  onViewEvents,
}: AuthSidebarProps) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await apiRequest<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      if (res?.data) {
        onLoginSuccess(res.data.user, res.data.accessToken);
        setAuthEmail('');
        setAuthPassword('');
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await apiRequest<{ accessToken: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: regFirstName.trim(),
          lastName: regLastName.trim(),
          email: authEmail.trim(),
          password: authPassword,
        }),
      });
      if (res?.data) {
        onLoginSuccess(res.data.user, res.data.accessToken);
        setAuthEmail('');
        setAuthPassword('');
        setRegFirstName('');
        setRegLastName('');
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  return (
    <aside className="sidebar-section">
      {/* AUTH CARD */}
      <div className="brutal-card auth-card">
        <div className="card-header">[ OPERATOR AUTHENTICATION ]</div>
        <div className="card-body">
          {currentUser ? (
            <div className="user-session-view">
              <div className="user-badge">&gt;&gt; u/{formatUserCallsign(currentUser)}</div>
              <div className="role-badge">ROLE: {currentUser.role}</div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  wordBreak: 'break-all',
                  marginTop: '4px',
                }}
              >
                EMAIL: {currentUser.email}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--accent-green)',
                  fontWeight: 700,
                  marginTop: '4px',
                }}
              >
                [ JWT SESSION ACTIVE ]
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                <button
                  className="brutal-btn mini"
                  style={{ flex: 1 }}
                  onClick={onOpenProfile}
                >
                  [ EDIT PROFILE ]
                </button>
                <button
                  className="brutal-btn mini red-btn"
                  style={{ flex: 1 }}
                  onClick={onLogout}
                >
                  [ LOGOUT ]
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-container">
              <div className="auth-tabs">
                <button
                  className={`tab-btn ${authTab === 'login' ? 'active' : ''}`}
                  onClick={() => setAuthTab('login')}
                >
                  LOGIN
                </button>
                <button
                  className={`tab-btn ${authTab === 'register' ? 'active' : ''}`}
                  onClick={() => setAuthTab('register')}
                >
                  REGISTER
                </button>
              </div>

              {authError && <div className="auth-status error">[ {authError} ]</div>}

              {authTab === 'login' ? (
                <form onSubmit={handleLogin} className="auth-form">
                  <label className="form-label">CAMPUS EMAIL</label>
                  <input
                    type="email"
                    className="brutal-input"
                    placeholder="user@campus.edu"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                  <label className="form-label">PASSWORD</label>
                  <input
                    type="password"
                    className="brutal-input"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                  <button type="submit" className="brutal-btn full red-btn" style={{ marginTop: '6px' }}>
                    [ AUTHENTICATE ]
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="auth-form">
                  <label className="form-label">FIRST NAME</label>
                  <input
                    type="text"
                    className="brutal-input"
                    placeholder="Alex"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    required
                  />
                  <label className="form-label">LAST NAME</label>
                  <input
                    type="text"
                    className="brutal-input"
                    placeholder="Chen"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    required
                  />
                  <label className="form-label">CAMPUS EMAIL</label>
                  <input
                    type="email"
                    className="brutal-input"
                    placeholder="alex@campus.edu"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                  <label className="form-label">PASSWORD</label>
                  <input
                    type="password"
                    className="brutal-input"
                    placeholder="Min 8 chars"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button type="submit" className="brutal-btn full" style={{ marginTop: '6px' }}>
                    [ CREATE ACCOUNT ]
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ACTION BUTTON */}
      <button
        className="brutal-btn full red-btn"
        style={{ padding: '10px 14px', fontSize: '12px' }}
        onClick={onOpenCreatePost}
      >
        + DISPATCH BROADCAST
      </button>

      {/* TICKET WALLET (SIDEBAR PREVIEW) */}
      <div className="brutal-card wallet-card">
        <div className="card-header highlight">[ TICKET WALLET ({userTickets.length}) ]</div>
        <div className="card-body">
          {userTickets.length === 0 ? (
            <div className="empty-wallet">[ NO TICKETS ISSUED YET ]</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {userTickets.slice(0, 2).map((t, idx) => (
                <div key={t.id || idx} className="ticket-pass" style={{ margin: 0, padding: '8px' }}>
                  <div className="ticket-pass-title" style={{ fontSize: '11px' }}>{t.eventTitle || 'Campus Keynote'}</div>
                  <div className="ticket-pass-code" style={{ fontSize: '14px' }}>{t.ticketCode}</div>
                </div>
              ))}
              {userTickets.length > 2 && (
                <button className="action-link" onClick={onViewEvents}>
                  [ VIEW ALL {userTickets.length} PASSES &gt;&gt; ]
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SYSTEM TELEMETRY */}
      <div className="brutal-card rules-card">
        <div className="card-header">[ TELEMETRY &amp; ARCHITECTURE ]</div>
        <div className="card-body rules-body">
          <div className="rule-row">
            <span className="rule-code">TECH-01</span>
            <span className="rule-desc">Next.js 16 App Router + Turbopack</span>
          </div>
          <div className="rule-row">
            <span className="rule-code">TECH-02</span>
            <span className="rule-desc">Express 5 + Prisma + PostgreSQL</span>
          </div>
          <div className="rule-row">
            <span className="rule-code">TECH-03</span>
            <span className="rule-desc">Redis ZSet Sliding-Window Rate Limit</span>
          </div>
          <div className="rule-row">
            <span className="rule-code">TECH-04</span>
            <span className="rule-desc">PostgreSQL Row Locks (SELECT FOR UPDATE)</span>
          </div>
          <div className="rule-row">
            <span className="rule-code">TECH-05</span>
            <span className="rule-desc">Real-Time EventSource SSE Pub/Sub</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
