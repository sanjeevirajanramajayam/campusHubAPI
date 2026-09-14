'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Post, Club, EventItem, Ticket, User, apiRequest } from '@/lib/api';
import { useRealtimeFeed, RealtimeFeedPayload } from '@/hooks/useRealtimeFeed';
import { TickerBar } from '@/components/TickerBar';
import { SubredditNav } from '@/components/SubredditNav';
import { SearchBar } from '@/components/SearchBar';
import { PostCard } from '@/components/PostCard';
import { CommentDrawer } from '@/components/CommentDrawer';
import { ClubsDirectory } from '@/components/ClubsDirectory';
import { EventsSchedule } from '@/components/EventsSchedule';
import { ProfileModal } from '@/components/ProfileModal';

export default function CampusHubApp() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<'feed' | 'clubs' | 'events'>('feed');
  const [currentClubId, setCurrentClubId] = useState<string>('');
  const [currentSort, setCurrentSort] = useState<'newest' | 'top'>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data State
  const [posts, setPosts] = useState<Post[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userMemberships, setUserMemberships] = useState<Set<string>>(new Set());
  const [userTickets, setUserTickets] = useState<Ticket[]>([]);

  // Auth Form State (Logged Out)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Modals
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Create Post Form
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostClub, setNewPostClub] = useState('');

  // Edit Post Form
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Real-Time SSE Listener
  const handleRealtimeEvent = useCallback((payload: RealtimeFeedPayload) => {
    const { type, data } = payload;
    if (!data) return;

    if (type === 'POST_VOTED') {
      setPosts((prev) =>
        prev.map((p) => (p.id === data.postId ? { ...p, likeCount: data.likeCount } : p)),
      );
    } else if (type === 'POST_CREATED') {
      setPosts((prev) => (prev.some((p) => p.id === data.post.id) ? prev : [data.post, ...prev]));
    } else if (type === 'POST_DELETED') {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === data.postId
            ? { ...p, isDeleted: true, content: '[This post was deleted by author]' }
            : p,
        ),
      );
    }
  }, []);

  const { status: sseStatus } = useRealtimeFeed(handleRealtimeEvent);

  // Hydrate User Session from LocalStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('campushub_user');
      if (storedUser) setCurrentUser(JSON.parse(storedUser));
      const storedTickets = localStorage.getItem('campushub_user_tickets');
      if (storedTickets) setUserTickets(JSON.parse(storedTickets));
    } catch {
      // Ignore JSON parse errors
    }
  }, []);

  // Fetch Clubs
  const loadClubs = async () => {
    try {
      const res = await apiRequest<{ clubs: Club[] }>('/clubs');
      if (res?.data?.clubs) setClubs(res.data.clubs);
    } catch (err: any) {
      console.warn('Failed to load clubs:', err.message);
    }
  };

  // Fetch Events
  const loadEvents = async () => {
    try {
      const res = await apiRequest<{ events: EventItem[] }>('/events');
      if (res?.data?.events) setEvents(res.data.events);
    } catch (err: any) {
      console.warn('Failed to load events:', err.message);
    }
  };

  // Fetch Posts with Search & Filter
  const loadPosts = async (signal?: AbortSignal) => {
    try {
      setLoadingPosts(true);
      const params = new URLSearchParams();
      if (currentClubId) params.set('tag', currentClubId);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', '1');
      params.set('limit', '25');

      const res = await apiRequest<{ posts: Post[] }>(`/posts?${params.toString()}`, { signal });
      if (res?.data?.posts) {
        let list = res.data.posts;
        if (currentSort === 'top') {
          list = [...list].sort((a, b) => b.likeCount - a.likeCount);
        }
        setPosts(list);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') console.warn('Failed to load posts:', err.message);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadClubs();
    loadEvents();
  }, []);

  useEffect(() => {
    loadPosts();
  }, [currentClubId, currentSort, searchQuery]);

  // Handle Post Vote
  const handleVote = async (postId: string) => {
    if (!currentUser) {
      alert('Authentication required to upvote.');
      return;
    }
    // Optimistic toggle
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              hasLiked: !p.hasLiked,
              likeCount: p.hasLiked ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p,
      ),
    );

    try {
      await apiRequest(`/posts/${postId}/like`, { method: 'POST' });
    } catch (err: any) {
      alert(`Vote failed: ${err.message}`);
      loadPosts(); // Revert on failure
    }
  };

  // Handle Post Delete
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to soft-delete this broadcast?')) return;
    try {
      await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isDeleted: true, content: '[This post was deleted by author]' }
            : p,
        ),
      );
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Handle Post Edit Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    try {
      await apiRequest(`/posts/${editingPost.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      setEditingPost(null);
      loadPosts();
    } catch (err: any) {
      alert(`Edit failed: ${err.message}`);
    }
  };

  // Handle Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent || !newPostClub) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          tags: [newPostClub],
        }),
      });
      setShowCreatePostModal(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostClub('');
      loadPosts();
    } catch (err: any) {
      alert(`Broadcast failed: ${err.message}`);
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await apiRequest<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      if (res?.data) {
        localStorage.setItem('campushub_token', res.data.accessToken);
        localStorage.setItem('campushub_user', JSON.stringify(res.data.user));
        setCurrentUser(res.data.user);
        setAuthEmail('');
        setAuthPassword('');
        loadPosts();
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Handle Register
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
        localStorage.setItem('campushub_token', res.data.accessToken);
        localStorage.setItem('campushub_user', JSON.stringify(res.data.user));
        setCurrentUser(res.data.user);
        loadPosts();
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('campushub_token');
    localStorage.removeItem('campushub_user');
    setCurrentUser(null);
    setUserMemberships(new Set());
    loadPosts();
  };

  return (
    <div className="campushub-root">
      {/* 1. TOP TELEMETRY BAR */}
      <TickerBar sseStatus={sseStatus} />

      {/* 2. CHANNELS SUBREDDIT NAV */}
      <SubredditNav
        clubs={clubs}
        currentClubId={currentClubId}
        onSelectClub={(slug) => setCurrentClubId(slug)}
      />

      {/* 3. HERO STRIP */}
      <header className="hero-strip">
        <h1 className="logo-title">CAMPUSHUB // TACTICAL FEED &amp; FORUM</h1>
        <p className="logo-sub">
          INDUSTRIAL INFORMATION DENSITY // ZERO FRAMEWORK FLUFF // PRODUCTION ACID ARCHITECTURE
        </p>
      </header>

      {/* 4. MAIN LAYOUT GRID */}
      <div className="main-layout">
        {/* LEFT COLUMN: FEED & DISPATCHES */}
        <main className="feed-column">
          {/* SEARCH BOX */}
          <SearchBar onSearch={(q, signal) => setSearchQuery(q)} />

          {/* MODULE VIEW TABS */}
          <div className="module-tabs" style={{ display: 'flex', gap: '4px', margin: '12px 0' }}>
            <button
              className={`module-tab-btn brutal-btn ${currentView === 'feed' ? 'active' : ''}`}
              onClick={() => setCurrentView('feed')}
            >
              [ 1. DISPATCH FEED ]
            </button>
            <button
              className={`module-tab-btn brutal-btn ${currentView === 'clubs' ? 'active' : ''}`}
              onClick={() => setCurrentView('clubs')}
            >
              [ 2. CLUBS DIRECTORY ({clubs.length}) ]
            </button>
            <button
              className={`module-tab-btn brutal-btn ${currentView === 'events' ? 'active' : ''}`}
              onClick={() => setCurrentView('events')}
            >
              [ 3. EVENTS SCHEDULE ({events.length}) ]
            </button>
          </div>

          {/* VIEW 1: FEED */}
          {currentView === 'feed' && (
            <div className="feed-view-container">
              {/* Filter Banner */}
              {currentClubId && (
                <div
                  className="filter-banner"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#e0ded8',
                    border: '2px solid #111',
                    marginBottom: '12px',
                  }}
                >
                  <span className="telemetry-mono">
                    FILTERED TO: <strong>c/{currentClubId}</strong>
                  </span>
                  <button className="action-btn mini text-red" onClick={() => setCurrentClubId('')}>
                    [ CLEAR FILTER X ]
                  </button>
                </div>
              )}

              {/* Sort Bar */}
              <div
                className="sort-bar"
                style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}
              >
                <button
                  className={`sort-btn brutal-btn mini ${currentSort === 'newest' ? 'active' : ''}`}
                  onClick={() => setCurrentSort('newest')}
                >
                  [ NEWEST DISPATCHES ]
                </button>
                <button
                  className={`sort-btn brutal-btn mini ${currentSort === 'top' ? 'active' : ''}`}
                  onClick={() => setCurrentSort('top')}
                >
                  [ TOP RATED ]
                </button>
              </div>

              {/* Posts Feed */}
              {loadingPosts ? (
                <div className="loading-box">[ STREAMING TELEMETRY FEED... ]</div>
              ) : posts.length === 0 ? (
                <div className="empty-box">[ NO DISPATCHES FOUND FOR CURRENT CHANNEL/QUERY ]</div>
              ) : (
                <div className="posts-stream">
                  {posts.map((post) => (
                    <React.Fragment key={post.id}>
                      <PostCard
                        post={post}
                        currentUser={currentUser}
                        isExpanded={expandedPostId === post.id}
                        onVote={handleVote}
                        onToggleComments={(id) =>
                          setExpandedPostId(expandedPostId === id ? null : id)
                        }
                        onEdit={(p) => {
                          setEditingPost(p);
                          setEditTitle(p.title);
                          setEditContent(p.content);
                        }}
                        onDelete={handleDeletePost}
                      />
                      {expandedPostId === post.id && (
                        <CommentDrawer
                          postId={post.id}
                          currentUser={currentUser}
                          onCommentCountChange={(pId, count) => {
                            setPosts((prev) =>
                              prev.map((p) => (p.id === pId ? { ...p, commentCount: count } : p)),
                            );
                          }}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: CLUBS */}
          {currentView === 'clubs' && (
            <ClubsDirectory
              clubs={clubs}
              currentUser={currentUser}
              userMemberships={userMemberships}
              onRefreshClubs={loadClubs}
              onViewClubFeed={(slug) => {
                setCurrentClubId(slug);
                setCurrentView('feed');
              }}
            />
          )}

          {/* VIEW 3: EVENTS */}
          {currentView === 'events' && (
            <EventsSchedule
              events={events}
              userTickets={userTickets}
              currentUser={currentUser}
              onRefreshEvents={loadEvents}
              onTicketClaimed={(ticket) => {
                const updated = [ticket, ...userTickets];
                setUserTickets(updated);
                localStorage.setItem('campushub_user_tickets', JSON.stringify(updated));
              }}
            />
          )}
        </main>

        {/* RIGHT COLUMN: SIDEBAR */}
        <aside className="sidebar-column">
          {/* AUTHENTICATION CARD */}
          <div className="sidebar-card">
            <div className="card-header">
              <span>[ IDENTITY TELEMETRY ]</span>
            </div>
            <div className="card-body">
              {currentUser ? (
                <div className="user-session-view">
                  <div className="user-badge">&gt;&gt; u/{currentUser.name}</div>
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
                      onClick={() => setShowProfileModal(true)}
                    >
                      [ EDIT PROFILE ]
                    </button>
                    <button
                      className="brutal-btn mini red-btn"
                      style={{ flex: 1 }}
                      onClick={handleLogout}
                    >
                      [ LOGOUT ]
                    </button>
                  </div>
                </div>
              ) : (
                <div className="auth-container">
                  <div className="auth-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    <button
                      className={`tab-btn brutal-btn mini ${authTab === 'login' ? 'active' : ''}`}
                      onClick={() => setAuthTab('login')}
                    >
                      LOGIN
                    </button>
                    <button
                      className={`tab-btn brutal-btn mini ${authTab === 'register' ? 'active' : ''}`}
                      onClick={() => setAuthTab('register')}
                    >
                      REGISTER
                    </button>
                  </div>

                  {authError && <div className="auth-status error">[ {authError} ]</div>}

                  {authTab === 'login' ? (
                    <form onSubmit={handleLogin}>
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
                      <button type="submit" className="brutal-btn full red-btn" style={{ marginTop: '8px' }}>
                        [ AUTHENTICATE ]
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegister}>
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
                      <button type="submit" className="brutal-btn full" style={{ marginTop: '8px' }}>
                        [ CREATE ACCOUNT ]
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ACTION BUTTON */}
          <div style={{ margin: '12px 0' }}>
            <button
              className="brutal-btn full red-btn"
              onClick={() => {
                if (!currentUser) alert('Authentication required to broadcast dispatches.');
                else setShowCreatePostModal(true);
              }}
            >
              [ + DISPATCH BROADCAST ]
            </button>
          </div>

          {/* TELEMETRY SPECS */}
          <div className="sidebar-card">
            <div className="card-header">
              <span>[ SYSTEM STATUS ]</span>
            </div>
            <div className="card-body telemetry-mono" style={{ fontSize: '11px', lineHeight: '1.6' }}>
              <div>• ARCH: NEXT.JS 16 APP ROUTER</div>
              <div>• BACKEND: EXPRESS 5 + PRISMA</div>
              <div>• RATE LIMIT: REDIS ZSET SLIDING</div>
              <div>• LOCKING: POSTGRES FOR UPDATE</div>
              <div>• PUB/SUB: REDIS + EVENTSOURCE</div>
            </div>
          </div>
        </aside>
      </div>

      {/* CREATE POST MODAL */}
      {showCreatePostModal && (
        <div className="brutal-modal-overlay">
          <div className="brutal-modal">
            <div className="brutal-modal-header">
              <span>[ DISPATCH NEW BROADCAST ]</span>
              <button className="modal-close-btn" onClick={() => setShowCreatePostModal(false)}>
                X
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="modal-body">
              <label className="form-label">TARGET CHANNEL</label>
              <select
                className="brutal-input"
                value={newPostClub}
                onChange={(e) => setNewPostClub(e.target.value)}
                required
              >
                <option value="">-- SELECT TARGET CHANNEL --</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.slug}>
                    c/{c.slug} ({c.name})
                  </option>
                ))}
              </select>

              <label className="form-label">HEADLINE / TITLE</label>
              <input
                type="text"
                className="brutal-input"
                placeholder="Autonomous Drone Testing Schedule..."
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                required
              />

              <label className="form-label">DISPATCH CONTENT</label>
              <textarea
                className="brutal-input"
                rows={4}
                placeholder="Full dispatch details..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                required
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button type="submit" className="brutal-btn full red-btn">
                  [ TRANSMIT DISPATCH ]
                </button>
                <button
                  type="button"
                  className="brutal-btn full"
                  onClick={() => setShowCreatePostModal(false)}
                >
                  [ CANCEL ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <div className="brutal-modal-overlay">
          <div className="brutal-modal">
            <div className="brutal-modal-header">
              <span>[ EDIT BROADCAST DISPATCH ]</span>
              <button className="modal-close-btn" onClick={() => setEditingPost(null)}>
                X
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="modal-body">
              <label className="form-label">HEADLINE</label>
              <input
                type="text"
                className="brutal-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />

              <label className="form-label">CONTENT</label>
              <textarea
                className="brutal-input"
                rows={4}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                required
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button type="submit" className="brutal-btn full red-btn">
                  [ SAVE CHANGES ]
                </button>
                <button
                  type="button"
                  className="brutal-btn full"
                  onClick={() => setEditingPost(null)}
                >
                  [ CANCEL ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE SETTINGS MODAL */}
      {showProfileModal && currentUser && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUserUpdated={(updated) => {
            setCurrentUser(updated);
            localStorage.setItem('campushub_user', JSON.stringify(updated));
          }}
        />
      )}
    </div>
  );
}
