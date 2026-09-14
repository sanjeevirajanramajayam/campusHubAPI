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
      const incomingLikes = Number(data.likeCount ?? data.totalLikes ?? 0);
      const safeLikes = !isNaN(incomingLikes) ? incomingLikes : 0;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === data.postId
            ? {
                ...p,
                likeCount: safeLikes,
                _count: {
                  likes: safeLikes,
                  comments: p.commentCount ?? p._count?.comments ?? 0,
                },
              }
            : p,
        ),
      );
    } else if (type === 'POST_CREATED') {
      const newPost = {
        ...data.post,
        likeCount: Number(data.post.likeCount ?? data.post._count?.likes ?? 0),
        commentCount: Number(data.post.commentCount ?? data.post._count?.comments ?? 0),
        hasLiked: false,
      };
      setPosts((prev) => (prev.some((p) => p.id === newPost.id) ? prev : [newPost, ...prev]));
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
      // Ignore parse error
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
        let list = res.data.posts.map((p) => ({
          ...p,
          likeCount: Number(p.likeCount ?? p._count?.likes ?? 0),
          commentCount: Number(p.commentCount ?? p._count?.comments ?? 0),
          hasLiked: Boolean(p.hasLiked ?? p.isLikedByCaller ?? false),
        }));
        if (currentSort === 'top') {
          list = [...list].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
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
      alert('Authentication required: please log in on the right panel to vote.');
      return;
    }

    // 1. Optimistic toggle
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentLikes = Number(p.likeCount ?? p._count?.likes ?? 0);
        const currentLiked = Boolean(p.hasLiked ?? p.isLikedByCaller ?? false);
        const nextLiked = !currentLiked;
        const nextLikes = nextLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);
        return {
          ...p,
          hasLiked: nextLiked,
          isLikedByCaller: nextLiked,
          likeCount: nextLikes,
          _count: {
            likes: nextLikes,
            comments: p.commentCount ?? p._count?.comments ?? 0,
          },
        };
      }),
    );

    try {
      const res = await apiRequest<{ liked: boolean; totalLikes: number }>(`/posts/${postId}/like`, {
        method: 'POST',
      });
      if (res?.data) {
        const { liked, totalLikes } = res.data;
        const confirmedCount = typeof totalLikes === 'number' && !isNaN(totalLikes) ? totalLikes : 0;
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  hasLiked: liked,
                  isLikedByCaller: liked,
                  likeCount: confirmedCount,
                  _count: {
                    likes: confirmedCount,
                    comments: p.commentCount ?? p._count?.comments ?? 0,
                  },
                }
              : p,
          ),
        );
      }
    } catch (err: any) {
      alert(`Vote failed: ${err.message}`);
      loadPosts();
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
    <div className="campushub-shell">
      {/* 1. TOP TICKER */}
      <TickerBar sseStatus={sseStatus} />

      {/* 2. CHANNELS SUBREDDIT NAV */}
      <SubredditNav
        clubs={clubs}
        currentClubId={currentClubId}
        onSelectClub={(slug) => {
          setCurrentClubId(slug);
          setCurrentView('feed');
        }}
      />

      {/* 3. HERO STRIP WITH INTEGRATED MODULE NAV */}
      <div className="hero-strip">
        <div className="hero-titles">
          <h1 className="logo-title">CAMPUS BULLETIN // BOARD</h1>
          <p className="logo-sub">
            TACTICAL COMMUNITY FEED &bull; CLUB DIRECTORY &bull; HIGH-CONCURRENCY TICKETING
          </p>
        </div>
        <nav className="module-nav-bar">
          <button
            className={`module-tab-btn ${currentView === 'feed' ? 'active' : ''}`}
            onClick={() => setCurrentView('feed')}
          >
            [ 01: BULLETIN FEED ]
          </button>
          <button
            className={`module-tab-btn ${currentView === 'clubs' ? 'active' : ''}`}
            onClick={() => setCurrentView('clubs')}
          >
            [ 02: CLUBS DIRECTORY ({clubs.length}) ]
          </button>
          <button
            className={`module-tab-btn ${currentView === 'events' ? 'active' : ''}`}
            onClick={() => setCurrentView('events')}
          >
            [ 03: CAMPUS EVENTS &amp; TICKETS ({events.length}) ]
          </button>
        </nav>
      </div>

      {/* 4. MAIN LAYOUT */}
      <main className="main-layout">
        {/* VIEW 1: BULLETIN FEED */}
        {currentView === 'feed' && (
          <section className="feed-section">
            {/* Feed Controls (Sort tabs + Search bar) */}
            <div className="feed-controls">
              <div className="sort-tabs">
                <button
                  className={`sort-btn ${currentSort === 'newest' ? 'active' : ''}`}
                  onClick={() => setCurrentSort('newest')}
                >
                  [ NEWEST ]
                </button>
                <button
                  className={`sort-btn ${currentSort === 'top' ? 'active' : ''}`}
                  onClick={() => setCurrentSort('top')}
                >
                  [ TOP UPVOTED ]
                </button>
              </div>

              <SearchBar onSearch={(q, signal) => setSearchQuery(q)} />
            </div>

            {/* Active Filter Banner */}
            {currentClubId && (
              <div className="filter-banner">
                <span>
                  FILTER: <strong>c/{currentClubId}</strong>
                </span>
                <button className="text-link" onClick={() => setCurrentClubId('')}>
                  [ RESET ]
                </button>
              </div>
            )}

            {/* Posts Stream */}
            <div className="posts-stream">
              {loadingPosts ? (
                <div className="loading-box">[ QUERYING FEED TELEMETRY... ]</div>
              ) : posts.length === 0 ? (
                <div className="empty-box">[ NO DISPATCHES FOUND FOR CURRENT CHANNEL ]</div>
              ) : (
                posts.map((post) => (
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
                ))
              )}
            </div>
          </section>
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

        {/* SIDEBAR */}
        <aside className="sidebar-section">
          {/* AUTH CARD */}
          <div className="brutal-card auth-card">
            <div className="card-header">[ OPERATOR AUTHENTICATION ]</div>
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
            onClick={() => {
              if (!currentUser) alert('Authentication required to broadcast dispatches.');
              else setShowCreatePostModal(true);
            }}
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
                    <button className="action-link" onClick={() => setCurrentView('events')}>
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
      </main>

      {/* CREATE POST MODAL */}
      {showCreatePostModal && (
        <div className="modal-overlay">
          <div className="modal-box brutal-modal">
            <div className="modal-header">
              <span>[ SUBMIT DISPATCH TO FEED ]</span>
              <button className="close-btn" onClick={() => setShowCreatePostModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="modal-body">
              <label className="form-label">ASSIGN TO CLUB / CHANNEL</label>
              <select
                className="brutal-select"
                value={newPostClub}
                onChange={(e) => setNewPostClub(e.target.value)}
                required
              >
                <option value="">-- SELECT TARGET CLUB --</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.slug}>
                    c/{c.slug} ({c.name})
                  </option>
                ))}
              </select>

              <label className="form-label">DISPATCH HEADLINE (TITLE)</label>
              <input
                type="text"
                className="brutal-input"
                placeholder="Clear, concise headline..."
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                required
                maxLength={150}
              />

              <label className="form-label">DISPATCH CONTENT</label>
              <textarea
                className="brutal-textarea"
                rows={4}
                placeholder="Full dispatch details..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                required
              />

              <div className="modal-footer">
                <button type="submit" className="brutal-btn red-btn">
                  [ TRANSMIT DISPATCH ]
                </button>
                <button
                  type="button"
                  className="brutal-btn"
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
        <div className="modal-overlay">
          <div className="modal-box brutal-modal">
            <div className="modal-header">
              <span>[ EDIT BROADCAST DISPATCH ]</span>
              <button className="close-btn" onClick={() => setEditingPost(null)}>
                &times;
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
                className="brutal-textarea"
                rows={4}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                required
              />

              <div className="modal-footer">
                <button type="submit" className="brutal-btn red-btn">
                  [ SAVE CHANGES ]
                </button>
                <button
                  type="button"
                  className="brutal-btn"
                  onClick={() => setEditingPost(null)}
                >
                  [ CANCEL ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
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
