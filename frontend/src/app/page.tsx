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
import { AuthSidebar } from '@/components/AuthSidebar';
import { CreatePostModal } from '@/components/CreatePostModal';
import { EditPostModal } from '@/components/EditPostModal';

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
  const [userMemberships, _setUserMemberships] = useState<Set<string>>(new Set());
  const [userTickets, setUserTickets] = useState<Ticket[]>([]);

  // Modals
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

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
      const incomingPost = data.post || data;
      const safeLikes = Number(incomingPost.likeCount ?? incomingPost._count?.likes ?? 0);
      const safeComments = Number(incomingPost.commentCount ?? incomingPost._count?.comments ?? 0);
      const newPost: Post = {
        ...incomingPost,
        likeCount: !isNaN(safeLikes) ? safeLikes : 0,
        commentCount: !isNaN(safeComments) ? safeComments : 0,
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
    } else if (type === 'COMMENT_CREATED') {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== data.postId) return p;
          const newCount = (p.commentCount ?? p._count?.comments ?? 0) + 1;
          return {
            ...p,
            commentCount: newCount,
            _count: {
              likes: p.likeCount ?? p._count?.likes ?? 0,
              comments: newCount,
            },
          };
        }),
      );
    } else if (type === 'COMMENT_DELETED') {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== data.postId) return p;
          const newCount = Math.max(0, (p.commentCount ?? p._count?.comments ?? 0) - 1);
          return {
            ...p,
            commentCount: newCount,
            _count: {
              likes: p.likeCount ?? p._count?.likes ?? 0,
              comments: newCount,
            },
          };
        }),
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
        let list = res.data.posts.map((p) => {
          const safeLikes = Number(p.likeCount ?? p._count?.likes ?? 0);
          const safeComments = Number(p.commentCount ?? p._count?.comments ?? 0);
          return {
            ...p,
            likeCount: !isNaN(safeLikes) ? safeLikes : 0,
            commentCount: !isNaN(safeComments) ? safeComments : 0,
            hasLiked: Boolean(p.hasLiked ?? p.isLikedByCaller ?? false),
          };
        });
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
      loadPosts(); // Revert on failure
      alert(`Vote failed: ${err.message}`);
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

  // Handle Logout
  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort logout
    } finally {
      localStorage.removeItem('campushub_token');
      localStorage.removeItem('campushub_user');
      setCurrentUser(null);
      setUserTickets([]);
      loadPosts();
    }
  };

  return (
    <div className="campushub-shell">
      {/* 1. TOP TICKER */}
      <TickerBar sseStatus={sseStatus} />

      {/* 2. CHANNELS SUBREDDIT NAV */}
      <SubredditNav
        clubs={clubs}
        currentClubId={currentClubId}
        onSelectClub={(slug: string) => {
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

              <SearchBar onSearch={(q: string) => setSearchQuery(q)} />
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

            <div className="posts-container">
              {loadingPosts ? (
                <div className="loading-box">[ SCANNING DATA LINK // FETCHING BROADCASTS... ]</div>
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
                      onEdit={(p) => setEditingPost(p)}
                      onDelete={handleDeletePost}
                    />
                    {expandedPostId === post.id && (
                      <CommentDrawer
                        postId={post.id}
                        currentUser={currentUser}
                        onCommentCountChange={(pId, count) => {
                          setPosts((prev) =>
                            prev.map((p) =>
                              p.id === pId
                                ? {
                                    ...p,
                                    commentCount: count,
                                    _count: {
                                      likes: p.likeCount ?? p._count?.likes ?? 0,
                                      comments: count,
                                    },
                                  }
                                : p,
                            ),
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

        {/* VIEW 2: CLUBS DIRECTORY */}
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

        {/* VIEW 3: EVENTS SCHEDULE */}
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

        {/* 4. SIDEBAR */}
        <AuthSidebar
          currentUser={currentUser}
          userTickets={userTickets}
          onOpenProfile={() => setShowProfileModal(true)}
          onLogout={handleLogout}
          onLoginSuccess={(user, token) => {
            localStorage.setItem('campushub_token', token);
            localStorage.setItem('campushub_user', JSON.stringify(user));
            setCurrentUser(user);
            loadPosts();
          }}
          onOpenCreatePost={() => {
            if (!currentUser) alert('Authentication required to broadcast dispatches.');
            else setShowCreatePostModal(true);
          }}
          onViewEvents={() => setCurrentView('events')}
        />
      </main>

      {/* CREATE POST MODAL */}
      {showCreatePostModal && (
        <CreatePostModal
          clubs={clubs}
          onClose={() => setShowCreatePostModal(false)}
          onPostCreated={loadPosts}
        />
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onPostUpdated={loadPosts}
        />
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
