/**
 * CAMPUSHUB // INDUSTRIAL BRUTALISM & OLD REDDIT CLIENT
 * Vanilla JS API Integration
 */

// ============================================================================
// 1. APPLICATION STATE
// ============================================================================
const state = {
  token: localStorage.getItem('campushub_token') || null,
  user: JSON.parse(localStorage.getItem('campushub_user') || 'null'),
  currentClubId: '',
  currentSort: 'newest',
  searchQuery: '',
  page: 1,
  limit: 15,
  totalPages: 1,
  clubs: [],
  posts: [],
  expandedPostId: null, // ID of post with open comment drawer
  currentView: 'feed',
  events: [],
  userTickets: JSON.parse(localStorage.getItem('campushub_user_tickets') || '[]'),
  userMemberships: new Set(),
};

// ============================================================================
// 2. HTTP CLIENT HELPER
// ============================================================================
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        logout();
      }
      const errorMsg =
        data.error?.message ||
        data.message ||
        (data.details && JSON.stringify(data.details)) ||
        'API request failed';
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      return null;
    }
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// ============================================================================
// 3. UTILITY FUNCTIONS
// ============================================================================
function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// 4. CLUBS & CHANNELS
// ============================================================================
async function loadClubs() {
  try {
    const res = await apiRequest('/clubs');
    state.clubs = res.data.clubs || res.data || [];
    renderClubNavigation();
    renderClubSelectDropdown();
  } catch (err) {
    console.warn('Could not load clubs list:', err.message);
  }
}

function renderClubNavigation() {
  const navBar = document.getElementById('club-nav-bar');
  const sidebarList = document.getElementById('sidebar-clubs-list');

  // Top Nav chips
  let navHtml = `
    <span class="nav-prefix">CHANNELS &gt;&gt;</span>
    <a href="#" class="club-chip ${state.currentClubId === '' ? 'active' : ''}" data-tag="">c/all</a>
  `;

  // Sidebar list
  let sidebarHtml = `
    <li>
      <a href="#" class="club-item-link ${state.currentClubId === '' ? 'active' : ''}" data-tag="">
        <span><strong>c/all</strong> (Campus Wide)</span>
        <span>&gt;&gt;</span>
      </a>
    </li>
  `;

  state.clubs.forEach((club) => {
    const slug = (club.slug || club.name.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    const isActive = state.currentClubId === slug;
    navHtml += `
      <a href="#" class="club-chip ${isActive ? 'active' : ''}" data-tag="${slug}">c/${escapeHtml(slug)}</a>
    `;
    sidebarHtml += `
      <li>
        <a href="#" class="club-item-link ${isActive ? 'active' : ''}" data-tag="${slug}">
          <span><strong>c/${escapeHtml(slug)}</strong> (${escapeHtml(club.name)})</span>
          <span>&gt;&gt;</span>
        </a>
      </li>
    `;
  });

  navBar.innerHTML = navHtml;
  sidebarList.innerHTML = sidebarHtml;

  // Bind click handlers
  navBar.querySelectorAll('.club-chip').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      setClubFilter(chip.dataset.tag, chip.textContent);
    });
  });

  sidebarList.querySelectorAll('.club-item-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setClubFilter(link.dataset.tag, link.querySelector('strong').textContent);
    });
  });
}

function renderClubSelectDropdown() {
  const select = document.getElementById('new-post-club');
  if (!select) return;

  let optionsHtml = '<option value="">-- SELECT TARGET CHANNEL --</option>';
  state.clubs.forEach((club) => {
    const slug = (club.slug || club.name.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    optionsHtml += `<option value="${slug}">c/${escapeHtml(slug)} (${escapeHtml(club.name)})</option>`;
  });
  select.innerHTML = optionsHtml;
}

function setClubFilter(tagSlug, label) {
  state.currentClubId = tagSlug || '';
  state.page = 1;

  const banner = document.getElementById('filter-banner');
  const labelEl = document.getElementById('current-filter-label');

  if (state.currentClubId) {
    banner.style.display = 'flex';
    labelEl.textContent = label || `c/${state.currentClubId}`;
  } else {
    banner.style.display = 'none';
  }

  renderClubNavigation();
  loadPosts();
}

// ============================================================================
// 5. POSTS STREAM
// ============================================================================
async function loadPosts(signal) {
  const container = document.getElementById('posts-container');
  container.innerHTML = '<div class="loading-box">[ STREAMING TELEMETRY FEED... ]</div>';

  try {
    const params = new URLSearchParams({
      page: state.page,
      limit: state.limit,
      sortBy: state.currentSort === 'top' ? 'popular' : 'latest',
    });
    if (state.currentClubId) params.append('tag', state.currentClubId);
    if (state.searchQuery) params.append('search', state.searchQuery);

    const res = await apiRequest(`/posts?${params.toString()}`, { signal });
    if (!res) return; // Request was aborted by newer input
    state.posts = res.data.posts || res.data.items || [];
    state.totalPages = res.data.pagination?.totalPages || 1;
    state.nextCursor = res.data.pagination?.nextCursor || null;
    state.hasMore = res.data.pagination?.hasMore || false;

    renderPosts();
    renderPagination();
  } catch (err) {
    if (err.name === 'AbortError') return;
    container.innerHTML = `<div class="loading-box" style="color: var(--accent-red);">[ ERROR LOADING FEED: ${escapeHtml(err.message)} ]</div>`;
  }
}

function renderPosts() {
  const container = document.getElementById('posts-container');
  if (!state.posts.length) {
    container.innerHTML = `
      <div class="loading-box">
        [ NO DISPATCHES FOUND FOR CURRENT QUERY ]<br/><br/>
        <button id="empty-create-btn" class="brutal-btn">[ + BROADCAST FIRST POST ]</button>
      </div>
    `;
    const btn = document.getElementById('empty-create-btn');
    if (btn) btn.addEventListener('click', openPostModal);
    return;
  }

    container.innerHTML = state.posts
    .map((post) => {
      const isUpvoted = !!(post.isLikedByCaller ?? post.hasLiked);
      const isAuthor = state.user && post.author && state.user.id === post.author.id;
      const clubSlug = (post.tags && post.tags[0]) || (post.club ? post.club.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'campus');
      const authorName = post.author
        ? post.author.firstName
          ? `${post.author.firstName} ${post.author.lastName || ''}`.trim()
          : post.author.name || 'unknown'
        : 'unknown';
      const likeCount = post.likeCount ?? post._count?.likes ?? 0;
      const commentCount = post.commentCount ?? post._count?.comments ?? 0;
      const isExpanded = state.expandedPostId === post.id;

      return `
      <article class="post-item" data-post-id="${post.id}">
        <!-- OLD REDDIT VOTE COLUMN -->
        <div class="vote-col">
          <button class="vote-btn post-upvote-btn ${isUpvoted ? 'upvoted' : ''}" title="Upvote dispatch" data-post-id="${post.id}">
            ▲
          </button>
          <span class="vote-count post-vote-count ${isUpvoted ? 'upvoted' : ''}" data-post-id="${post.id}">
            ${likeCount}
          </span>
          <button class="vote-btn" style="cursor: not-allowed; opacity: 0.3;" title="Negative votes prohibited by spec">
            ▼
          </button>
        </div>

        <!-- POST MAIN BODY -->
        <div class="post-main">
          <div class="post-header-line">
            <span class="post-badge">c/${escapeHtml(clubSlug)}</span>
            <a href="#" class="post-title post-title-link" data-post-id="${post.id}">${escapeHtml(post.title)}</a>
          </div>

          <div class="post-meta">
            submitted <strong>${formatTimeAgo(post.createdAt)}</strong> by
            <strong>u/${escapeHtml(authorName)}</strong>
            ${post.isEdited ? '<span class="badge">[ EDITED ]</span>' : ''}
          </div>

          <div class="post-body ${post.isDeleted ? 'tombstone' : ''}">
            ${escapeHtml(post.content)}
          </div>

          <div class="post-actions">
            <button class="action-link toggle-comments-btn" data-post-id="${post.id}">
              [ ${commentCount} COMMENTS ]
            </button>
            <button class="action-link reply-post-btn" data-post-id="${post.id}">
              [ REPLY ]
            </button>
            ${
              isAuthor && !post.isDeleted
                ? `
              <button class="action-link edit-post-btn" data-post-id="${post.id}">[ EDIT ]</button>
              <button class="action-link red delete-post-btn" data-post-id="${post.id}">[ DELETE ]</button>
            `
                : ''
            }
          </div>
        </div>

        <!-- THREADED COMMENTS DRAWER -->
        <div class="comments-drawer" id="comments-drawer-${post.id}" style="display: ${isExpanded ? 'block' : 'none'};">
          <div class="comments-header">
            <span>THREADED DISCUSSION (MAX 3-LEVEL DEPTH)</span>
            <button class="action-link close-drawer-btn" data-post-id="${post.id}">[ HIDE THREAD ]</button>
          </div>

          <!-- TOP-LEVEL COMMENT INPUT -->
          <div class="comment-input-box">
            <textarea id="comment-input-${post.id}" rows="2" placeholder="${state.user ? 'Write a constructive top-level reply...' : 'Authenticate to participate in this discussion...'}"></textarea>
            <div>
              <button class="brutal-btn mini submit-comment-btn" data-post-id="${post.id}">[ POST COMMENT ]</button>
            </div>
          </div>

          <!-- RECURSIVE COMMENTS TREE CONTAINER -->
          <div class="comment-tree" id="comment-tree-${post.id}">
            <div class="loading-sub">[ QUERYING THREAD TREE... ]</div>
          </div>
        </div>
      </article>
    `;
    })
    .join('');

  attachPostEventListeners();
}

function attachPostEventListeners() {
  // Post upvoting
  document.querySelectorAll('.post-upvote-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postId;
      await togglePostLike(postId);
    });
  });

  // Toggle comments
  document.querySelectorAll('.toggle-comments-btn, .post-title-link, .reply-post-btn').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const postId = el.dataset.postId;
      toggleCommentsDrawer(postId);
    });
  });

  // Close drawer
  document.querySelectorAll('.close-drawer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.postId;
      toggleCommentsDrawer(postId, false);
    });
  });

  // Submit top-level comment
  document.querySelectorAll('.submit-comment-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postId;
      const textarea = document.getElementById(`comment-input-${postId}`);
      const content = textarea.value.trim();
      if (!content) return;
      await submitComment(postId, content, null);
      textarea.value = '';
    });
  });

  // Delete post
  document.querySelectorAll('.delete-post-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const postId = btn.dataset.postId;
      if (confirm('Are you sure you want to delete this dispatch? (It will be preserved as a tombstone for child threads)')) {
        await deletePost(postId);
      }
    });
  });

  // Edit post
  document.querySelectorAll('.edit-post-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.postId;
      const post = state.posts.find((p) => p.id === postId);
      if (post) openEditModal('post', post.id, post.title, post.content);
    });
  });
}

// ============================================================================
// 6. UPVOTES (POSTS & COMMENTS)
// ============================================================================
async function togglePostLike(postId) {
  if (!state.token) {
    alert('Authentication required: please log in on the right panel to vote.');
    return;
  }

  try {
    const res = await apiRequest(`/posts/${postId}/like`, { method: 'POST' });
    const liked = res.data.liked;
    const likeCount = res.data.totalLikes ?? res.data.likeCount;

    // Update in local state
    const post = state.posts.find((p) => p.id === postId);
    if (post) {
      post.hasLiked = liked;
      post.likeCount = likeCount;
    }

    // Update DOM directly for instant response
    const countEl = document.querySelector(`.post-vote-count[data-post-id="${postId}"]`);
    const btnEl = document.querySelector(`.post-upvote-btn[data-post-id="${postId}"]`);
    if (countEl) {
      countEl.textContent = likeCount;
      countEl.classList.toggle('upvoted', liked);
    }
    if (btnEl) {
      btnEl.classList.toggle('upvoted', liked);
    }
  } catch (err) {
    alert(`Voting failed: ${err.message}`);
  }
}

async function toggleCommentLike(postId, commentId) {
  if (!state.token) {
    alert('Authentication required to vote.');
    return;
  }

  try {
    const res = await apiRequest(`/posts/${postId}/comments/${commentId}/like`, { method: 'POST' });
    const liked = res.data.liked;
    const likeCount = res.data.totalLikes ?? res.data.likeCount;

    const countEl = document.getElementById(`comment-votes-${commentId}`);
    const btnEl = document.getElementById(`comment-upvote-${commentId}`);
    if (countEl) {
      countEl.textContent = likeCount;
      countEl.classList.toggle('upvoted', liked);
    }
    if (btnEl) {
      btnEl.classList.toggle('upvoted', liked);
    }
  } catch (err) {
    alert(`Vote error: ${err.message}`);
  }
}

// ============================================================================
// 7. THREADED COMMENTS DRAWER & TREE
// ============================================================================
async function toggleCommentsDrawer(postId, forceState) {
  const drawer = document.getElementById(`comments-drawer-${postId}`);
  if (!drawer) return;

  const shouldOpen = forceState !== undefined ? forceState : drawer.style.display === 'none';

  if (shouldOpen) {
    drawer.style.display = 'block';
    state.expandedPostId = postId;
    await loadComments(postId);
  } else {
    drawer.style.display = 'none';
    if (state.expandedPostId === postId) state.expandedPostId = null;
  }
}

async function loadComments(postId) {
  const treeContainer = document.getElementById(`comment-tree-${postId}`);
  if (!treeContainer) return;
  treeContainer.innerHTML = '<div class="loading-sub">[ QUERYING THREAD TREE... ]</div>';

  try {
    const res = await apiRequest(`/posts/${postId}/comments`);
    const comments = res.data.comments || res.data || [];

    if (!comments.length) {
      treeContainer.innerHTML = '<div class="loading-sub">[ NO RESPONSES RECORDED. BE THE FIRST TO WEIGH IN. ]</div>';
      return;
    }

    treeContainer.innerHTML = renderCommentNodes(comments, postId);
    attachCommentTreeListeners(postId);
  } catch (err) {
    treeContainer.innerHTML = `<div class="loading-sub" style="color: var(--accent-red);">[ FAILED TO LOAD COMMENTS: ${escapeHtml(err.message)} ]</div>`;
  }
}

function renderCommentNodes(comments, postId) {
  return comments
    .map((comment) => {
      const depth = comment.depth || 1;
      const isUpvoted = !!(comment.isLikedByCaller ?? comment.hasLiked);
      const isAuthor = state.user && comment.author && state.user.id === comment.author.id;
      const authorName = comment.author
        ? comment.author.firstName
          ? `${comment.author.firstName} ${comment.author.lastName || ''}`.trim()
          : comment.author.name || 'anonymous'
        : 'anonymous';
      const likeCount = comment.likeCount ?? comment._count?.likes ?? 0;
      const canReply = depth < 3 && !comment.isDeleted;

      let html = `
      <div class="comment-node depth-${depth}" id="comment-node-${comment.id}">
        <div class="comment-meta">
          <span class="comment-depth-tag">L${depth}</span>
          <span class="comment-author">u/${escapeHtml(authorName)}</span>
          <span>&bull;</span>
          <span>${formatTimeAgo(comment.createdAt)}</span>
          ${comment.isEdited ? '<span class="badge">[ EDITED ]</span>' : ''}
        </div>

        <div class="comment-text ${comment.isDeleted ? 'tombstone' : ''}">
          ${escapeHtml(comment.content)}
        </div>

        <div class="comment-actions">
          <button class="action-link comment-vote-btn ${isUpvoted ? 'upvoted' : ''}" id="comment-upvote-${comment.id}" data-post-id="${postId}" data-comment-id="${comment.id}">
            ▲ [ <span id="comment-votes-${comment.id}">${likeCount}</span> ]
          </button>
          ${
            canReply
              ? `<button class="action-link show-reply-box-btn" data-post-id="${postId}" data-comment-id="${comment.id}">[ REPLY ]</button>`
              : depth >= 3
                ? `<span style="color: #888; font-size: 9px;">[ MAX DEPTH ]</span>`
                : ''
          }
          ${
            isAuthor && !comment.isDeleted
              ? `
            <button class="action-link edit-comment-btn" data-post-id="${postId}" data-comment-id="${comment.id}" data-content="${escapeHtml(comment.content)}">[ EDIT ]</button>
            <button class="action-link red delete-comment-btn" data-post-id="${postId}" data-comment-id="${comment.id}">[ DELETE ]</button>
          `
              : ''
          }
        </div>

        <!-- Dynamic Inline Reply Container -->
        <div id="reply-box-container-${comment.id}" style="display: none;"></div>

        <!-- Child Replies (Recursion) -->
        ${
          comment.replies && comment.replies.length > 0
            ? `<div class="comment-children">${renderCommentNodes(comment.replies, postId)}</div>`
            : ''
        }
      </div>
    `;
      return html;
    })
    .join('');
}

function attachCommentTreeListeners(postId) {
  // Upvote comment
  document.querySelectorAll(`.comment-vote-btn[data-post-id="${postId}"]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleCommentLike(postId, btn.dataset.commentId);
    });
  });

  // Show inline reply form
  document.querySelectorAll(`.show-reply-box-btn[data-post-id="${postId}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const commentId = btn.dataset.commentId;
      openInlineReplyForm(postId, commentId);
    });
  });

  // Delete comment
  document.querySelectorAll(`.delete-comment-btn[data-post-id="${postId}"]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const commentId = btn.dataset.commentId;
      if (confirm('Delete this comment? (Child replies will be preserved under tombstone)')) {
        await deleteComment(postId, commentId);
      }
    });
  });

  // Edit comment
  document.querySelectorAll(`.edit-comment-btn[data-post-id="${postId}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const commentId = btn.dataset.commentId;
      const content = btn.dataset.content;
      openEditModal('comment', commentId, null, content, postId);
    });
  });
}

function openInlineReplyForm(postId, parentId) {
  const container = document.getElementById(`reply-box-container-${parentId}`);
  if (!container) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <form class="reply-form" id="reply-form-${parentId}">
      <textarea id="reply-textarea-${parentId}" rows="2" placeholder="${state.user ? 'Write targeted reply...' : 'Log in to respond...'}" required></textarea>
      <div style="display: flex; gap: 6px;">
        <button type="submit" class="brutal-btn mini">[ SUBMIT ]</button>
        <button type="button" class="brutal-btn mini cancel-reply-btn" data-parent-id="${parentId}">[ CANCEL ]</button>
      </div>
    </form>
  `;

  container.querySelector('.cancel-reply-btn').addEventListener('click', () => {
    container.style.display = 'none';
    container.innerHTML = '';
  });

  document.getElementById(`reply-form-${parentId}`).addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById(`reply-textarea-${parentId}`).value.trim();
    if (!text) return;
    await submitComment(postId, text, parentId);
    container.style.display = 'none';
    container.innerHTML = '';
  });
}

async function submitComment(postId, content, parentId) {
  if (!state.token) {
    alert('Please log in on the right panel to post comments.');
    return;
  }

  try {
    await apiRequest(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId: parentId || undefined }),
    });

    // Increment post commentCount locally
    const post = state.posts.find((p) => p.id === postId);
    if (post) post.commentCount += 1;

    // Refresh comments tree
    await loadComments(postId);
  } catch (err) {
    alert(`Comment failed: ${err.message}`);
  }
}

async function deleteComment(postId, commentId) {
  try {
    await apiRequest(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    await loadComments(postId);
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

async function deletePost(postId) {
  try {
    await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
    await loadPosts();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

// ============================================================================
// 8. CREATE & EDIT DISPATCHES (MODALS)
// ============================================================================
function openPostModal() {
  if (!state.token) {
    alert('Authentication required: please log in or register before submitting posts.');
    return;
  }
  document.getElementById('post-modal').style.display = 'flex';
}

function closePostModal() {
  document.getElementById('post-modal').style.display = 'none';
}

function openEditModal(type, itemId, title, content, parentPostId = null) {
  const modal = document.getElementById('edit-modal');
  const titleGroup = document.getElementById('edit-title-group');
  const titleInput = document.getElementById('edit-title-input');
  const contentInput = document.getElementById('edit-content-input');
  const typeInput = document.getElementById('edit-type');
  const itemIdInput = document.getElementById('edit-item-id');
  const parentIdInput = document.getElementById('edit-parent-post-id');

  typeInput.value = type;
  itemIdInput.value = itemId;
  parentIdInput.value = parentPostId || '';
  contentInput.value = content || '';

  if (type === 'post') {
    titleGroup.style.display = 'block';
    titleInput.value = title || '';
    titleInput.required = true;
  } else {
    titleGroup.style.display = 'none';
    titleInput.required = false;
  }

  modal.style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

function openProfileModal() {
  if (!state.user) return;
  const nameInput = document.getElementById('edit-profile-name');
  const avatarInput = document.getElementById('edit-profile-avatar');
  if (nameInput) nameInput.value = state.user.name || '';
  if (avatarInput) avatarInput.value = state.user.avatarUrl || '';
  document.getElementById('profile-modal').style.display = 'flex';
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('edit-profile-form');
  if (form) form.reset();
}

// ============================================================================
// 9. AUTHENTICATION (LOGIN, REGISTER, LOGOUT)
// ============================================================================
function renderAuthCard() {
  const container = document.getElementById('auth-card-body');
  if (!container) return;

  if (state.token && state.user) {
    container.innerHTML = `
      <div class="user-session-view">
        <div class="user-badge">&gt;&gt; u/${escapeHtml(state.user.name)}</div>
        <div class="role-badge">ROLE: ${escapeHtml(state.user.role)}</div>
        <div style="font-size: 10px; color: var(--text-muted); word-break: break-all;">
          EMAIL: ${escapeHtml(state.user.email)}
        </div>
        <div style="font-size: 10px; color: var(--accent-green); font-weight: 700;">
          [ JWT SESSION ACTIVE ]
        </div>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button id="btn-edit-profile" class="brutal-btn mini" style="flex: 1;">[ EDIT PROFILE ]</button>
          <button id="logout-btn" class="brutal-btn mini red-btn" style="flex: 1;">[ LOGOUT ]</button>
        </div>
      </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('btn-edit-profile').addEventListener('click', openProfileModal);
  } else {
    // Reset to login/register form
    container.innerHTML = `
      <div class="auth-tabs">
        <button id="tab-login" class="tab-btn active">LOGIN</button>
        <button id="tab-register" class="tab-btn">REGISTER</button>
      </div>

      <form id="login-form" class="auth-form">
        <label class="form-label">CAMPUS EMAIL</label>
        <input type="email" id="login-email" class="brutal-input" placeholder="user@campus.edu" required />
        <label class="form-label">PASSWORD</label>
        <input type="password" id="login-password" class="brutal-input" placeholder="••••••••" required />
        <button type="submit" class="brutal-btn full red-btn">[ AUTHENTICATE ]</button>
      </form>

      <form id="register-form" class="auth-form" style="display: none;">
        <label class="form-label">FIRST NAME</label>
        <input type="text" id="reg-first-name" class="brutal-input" placeholder="Alex" required />
        <label class="form-label">LAST NAME</label>
        <input type="text" id="reg-last-name" class="brutal-input" placeholder="Chen" required />
        <label class="form-label">CAMPUS EMAIL</label>
        <input type="email" id="reg-email" class="brutal-input" placeholder="alex@campus.edu" required />
        <label class="form-label">PASSWORD</label>
        <input type="password" id="reg-password" class="brutal-input" placeholder="Min 8 characters" required minlength="8" />
        <button type="submit" class="brutal-btn full">[ CREATE ACCOUNT ]</button>
      </form>

      <div id="auth-status" class="auth-status" style="display: none;"></div>
    `;

    bindAuthFormEvents();
  }
}

function bindAuthFormEvents() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const statusEl = document.getElementById('auth-status');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.style.display = 'flex';
      registerForm.style.display = 'none';
      statusEl.style.display = 'none';
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.style.display = 'flex';
      loginForm.style.display = 'none';
      statusEl.style.display = 'none';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        statusEl.style.display = 'block';
        statusEl.className = 'auth-status';
        statusEl.textContent = '[ VERIFYING CREDENTIALS... ]';

        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        loginSuccess(res.data);
      } catch (err) {
        statusEl.className = 'auth-status error';
        statusEl.textContent = `[ AUTH FAILED: ${err.message} ]`;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstNameInput = document.getElementById('reg-first-name');
      const lastNameInput = document.getElementById('reg-last-name');
      const legacyNameInput = document.getElementById('reg-name');

      let firstName = '';
      let lastName = '';

      if (firstNameInput && lastNameInput) {
        firstName = firstNameInput.value.trim();
        lastName = lastNameInput.value.trim();
      } else if (legacyNameInput) {
        const parts = legacyNameInput.value.trim().split(' ');
        firstName = parts[0] || 'Member';
        lastName = parts.slice(1).join(' ') || 'User';
      }

      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

      try {
        statusEl.style.display = 'block';
        statusEl.className = 'auth-status';
        statusEl.textContent = '[ ENROLLING OPERATOR... ]';

        const res = await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ firstName, lastName, email, password }),
        });

        loginSuccess(res.data);
      } catch (err) {
        statusEl.className = 'auth-status error';
        statusEl.textContent = `[ REGISTRATION FAILED: ${err.message} ]`;
      }
    });
  }
}

function loginSuccess(data) {
  state.token = data.accessToken;
  state.user = data.user;
  localStorage.setItem('campushub_token', state.token);
  localStorage.setItem('campushub_user', JSON.stringify(state.user));

  renderAuthCard();
  renderUserAffiliations();
  if (state.currentView === 'clubs') loadClubsDirectory();
  if (state.currentView === 'events') loadEventsDirectory();
  loadPosts(); // Reload feed to hydrate `hasLiked`
}

function logout() {
  state.token = null;
  state.user = null;
  state.userMemberships.clear();
  localStorage.removeItem('campushub_token');
  localStorage.removeItem('campushub_user');
  renderAuthCard();
  renderUserAffiliations();
  if (state.currentView === 'clubs') renderClubsDirectory();
  if (state.currentView === 'events') renderEventsDirectory();
  loadPosts();
}

// ============================================================================
// 10. PAGINATION & SORTING
// ============================================================================
function renderPagination() {
  const bar = document.getElementById('pagination-bar');
  const indicator = document.getElementById('page-indicator');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (state.totalPages <= 1) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  const cursorTag = state.nextCursor ? ' [CURSOR: READY]' : '';
  indicator.textContent = `PAGE ${state.page} / ${state.totalPages}${cursorTag}`;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= state.totalPages;
}

// ============================================================================
// 10A. VIEW SWITCHING & MODULE ROUTING
// ============================================================================
function switchView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.module-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const views = ['feed', 'clubs', 'events'];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.style.display = v === viewName ? 'grid' : 'none';
    }
  });

  if (viewName === 'clubs') {
    loadClubsDirectory();
  } else if (viewName === 'events') {
    loadEventsDirectory();
    renderTicketWallet();
  } else if (viewName === 'feed') {
    loadPosts();
  }
}

// ============================================================================
// 10B. CLUBS DIRECTORY & MEMBERSHIPS
// ============================================================================
async function loadClubsDirectory() {
  const container = document.getElementById('clubs-directory-grid');
  const counter = document.getElementById('clubs-total-counter');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading-box">[ QUERYING CLUBS DIRECTORY... ]</div>';
    const res = await apiRequest('/clubs');
    state.clubs = res.data.clubs || res.data || [];
    if (counter) counter.textContent = `[ ${state.clubs.length} CHARTERED CHAPTERS ]`;

    renderClubsDirectory();
    renderUserAffiliations();
  } catch (err) {
    container.innerHTML = `<div class="loading-box text-red">[ FAILED TO LOAD CLUBS: ${escapeHtml(err.message)} ]</div>`;
  }
}

function renderClubsDirectory() {
  const container = document.getElementById('clubs-directory-grid');
  if (!container) return;

  if (state.clubs.length === 0) {
    container.innerHTML = '<div class="loading-box">[ NO CLUBS REGISTERED YET ]</div>';
    return;
  }

  let html = '';
  state.clubs.forEach((club) => {
    const memberCount = club._count?.members ?? 0;
    const isMember = state.userMemberships.has(club.id);

    html += `
      <div class="directory-card" data-club-id="${club.id}">
        <div class="directory-card-header">
          <span class="directory-card-slug">c/${escapeHtml(club.slug || 'club')}</span>
          <span class="badge ${memberCount > 0 ? 'green' : ''}">[ ${memberCount} MEMBERS ]</span>
        </div>
        <h3 class="directory-card-title">${escapeHtml(club.name)}</h3>
        <p class="directory-card-desc">${escapeHtml(club.description || 'No description provided.')}</p>
        <div class="directory-card-meta">
          <div class="meta-item">
            <strong>FOUNDED:</strong> <span>${formatTimeAgo(club.createdAt)}</span>
          </div>
          <div class="meta-item">
            <strong>ID:</strong> <span class="telemetry-mono">${club.id.substring(0, 8)}...</span>
          </div>
        </div>
        <div class="directory-card-actions">
          ${
            isMember
              ? `<button class="brutal-btn mini red-btn btn-leave-club" data-club-id="${club.id}">[ LEAVE CLUB ]</button>`
              : `<button class="brutal-btn mini btn-join-club" data-club-id="${club.id}">[ JOIN CLUB ]</button>`
          }
          <button class="brutal-btn mini btn-view-club-feed" data-tag="${escapeHtml(club.slug || '')}" data-name="${escapeHtml(club.name)}">
            [ VIEW FEED DISPATCHES &gt;&gt; ]
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.btn-join-club').forEach((btn) => {
    btn.addEventListener('click', () => handleJoinClub(btn.dataset.clubId));
  });
  container.querySelectorAll('.btn-leave-club').forEach((btn) => {
    btn.addEventListener('click', () => handleLeaveClub(btn.dataset.clubId));
  });
  container.querySelectorAll('.btn-view-club-feed').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      const name = btn.dataset.name;
      switchView('feed');
      setClubFilter(tag, `c/${tag} (${name})`);
    });
  });
}

async function handleJoinClub(clubId) {
  if (!state.user) {
    alert('Authentication required to join campus clubs. Please login.');
    return;
  }
  try {
    await apiRequest(`/clubs/${clubId}/join`, { method: 'POST' });
    state.userMemberships.add(clubId);
    await loadClubs();
    renderClubsDirectory();
    renderUserAffiliations();
  } catch (err) {
    alert(`Failed to join club: ${err.message}`);
  }
}

async function handleLeaveClub(clubId) {
  if (!state.user) return;
  try {
    await apiRequest(`/clubs/${clubId}/leave`, { method: 'DELETE' });
    state.userMemberships.delete(clubId);
    await loadClubs();
    renderClubsDirectory();
    renderUserAffiliations();
  } catch (err) {
    alert(`Failed to leave club: ${err.message}`);
  }
}

function renderUserAffiliations() {
  const container = document.getElementById('user-clubs-summary-body');
  if (!container) return;

  if (!state.user) {
    container.innerHTML = '<p class="telemetry-mono text-muted">[ AUTHENTICATE TO VIEW AFFILIATIONS ]</p>';
    return;
  }

  const joinedClubs = state.clubs.filter((c) => state.userMemberships.has(c.id));
  if (joinedClubs.length === 0) {
    container.innerHTML = '<p class="telemetry-mono text-muted">[ NOT YET AFFILIATED WITH ANY CLUBS ]</p>';
    return;
  }

  let html = '<ul class="clubs-list">';
  joinedClubs.forEach((c) => {
    html += `
      <li>
        <span class="telemetry-mono"><strong>c/${escapeHtml(c.slug)}</strong> - ${escapeHtml(c.name)}</span>
      </li>
    `;
  });
  html += '</ul>';
  container.innerHTML = html;
}

function openClubModal() {
  if (!state.user) {
    alert('Authentication required to charter a club. Please log in.');
    return;
  }
  document.getElementById('club-modal').style.display = 'flex';
}

function closeClubModal() {
  document.getElementById('club-modal').style.display = 'none';
  document.getElementById('create-club-form').reset();
}

// ============================================================================
// 10C. EVENTS & CONCURRENCY TICKETING
// ============================================================================
async function loadEventsDirectory() {
  const container = document.getElementById('events-directory-grid');
  const counter = document.getElementById('events-total-counter');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading-box">[ QUERYING CAMPUS EVENTS SCHEDULE... ]</div>';
    const res = await apiRequest('/events');
    state.events = res.data.events || res.data || [];
    if (counter) counter.textContent = `[ ${state.events.length} ACTIVE EVENTS ]`;

    renderEventsDirectory();
  } catch (err) {
    container.innerHTML = `<div class="loading-box text-red">[ FAILED TO LOAD EVENTS: ${escapeHtml(err.message)} ]</div>`;
  }
}

function renderEventsDirectory() {
  const container = document.getElementById('events-directory-grid');
  if (!container) return;

  if (state.events.length === 0) {
    container.innerHTML = `
      <div class="loading-box">
        [ NO CAMPUS EVENTS CURRENTLY SCHEDULED ]<br><br>
        Club administrators can schedule workshops, hackathons, and lectures using the "+ SCHEDULE EVENT" button above.
      </div>
    `;
    return;
  }

  let html = '';
  state.events.forEach((ev) => {
    const isClaimed = state.userTickets.some((t) => t.eventId === ev.id);
    const hostClub = state.clubs.find((c) => c.id === ev.clubId);
    const hostSlug = hostClub ? `c/${hostClub.slug}` : 'CAMPUS-WIDE';

    const startDate = new Date(ev.startTime);
    const endDate = new Date(ev.endTime);
    const timeFormatted = `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &rarr; ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    html += `
      <div class="directory-card event-card" data-event-id="${ev.id}">
        <div class="directory-card-header">
          <span class="directory-card-slug">${escapeHtml(hostSlug)}</span>
          <span class="badge ${isClaimed ? 'green' : 'red'}">[ ${isClaimed ? 'REGISTERED' : 'OPEN RSVP'} ]</span>
        </div>
        <h3 class="directory-card-title">${escapeHtml(ev.title)}</h3>
        <p class="directory-card-desc">${escapeHtml(ev.description || '')}</p>
        <div class="directory-card-meta">
          <div class="meta-item">
            <strong>LOCATION:</strong> <span>${escapeHtml(ev.location)}</span>
          </div>
          <div class="meta-item">
            <strong>TIME:</strong> <span>${timeFormatted}</span>
          </div>
          <div class="meta-item">
            <strong>CAPACITY:</strong> <span>${ev.capacity} SEATS</span>
          </div>
        </div>
        <div class="directory-card-actions">
          ${
            isClaimed
              ? `<button class="brutal-btn mini" disabled>[ &check; TICKET CLAIMED IN WALLET ]</button>`
              : `<button class="brutal-btn mini red-btn btn-claim-ticket" data-event-id="${ev.id}" data-event-title="${escapeHtml(ev.title)}">[ CLAIM TICKET / RSVP ]</button>`
          }
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.btn-claim-ticket').forEach((btn) => {
    btn.addEventListener('click', () => handleClaimTicket(btn.dataset.eventId, btn.dataset.eventTitle));
  });
}

async function handleClaimTicket(eventId, eventTitle) {
  if (!state.user) {
    alert('Operator authentication required to reserve tickets with ACID locking. Please log in.');
    return;
  }

  try {
    const res = await apiRequest(`/events/${eventId}/register`, { method: 'POST' });
    const reg = res.data.registration;

    const newTicket = {
      id: reg.id,
      ticketCode: reg.ticketCode,
      eventId: eventId,
      eventTitle: eventTitle,
      createdAt: reg.createdAt || new Date().toISOString(),
    };

    state.userTickets.unshift(newTicket);
    localStorage.setItem('campushub_user_tickets', JSON.stringify(state.userTickets));

    alert(`TICKET CONFIRMED!\n\nPass Code: ${newTicket.ticketCode}\nYour seat is locked in PostgreSQL via pessimistic row transaction.`);
    renderEventsDirectory();
    renderTicketWallet();
  } catch (err) {
    alert(`Ticket reservation failed: ${err.message}`);
  }
}

function renderTicketWallet() {
  const container = document.getElementById('ticket-wallet-list');
  if (!container) return;

  if (!state.userTickets || state.userTickets.length === 0) {
    container.innerHTML = '<div class="empty-wallet">[ NO TICKETS ISSUED YET. CLAIM AN RSVP FROM THE SCHEDULE. ]</div>';
    return;
  }

  let html = '';
  state.userTickets.forEach((ticket) => {
    html += `
      <div class="ticket-pass">
        <div class="ticket-pass-title">${escapeHtml(ticket.eventTitle || 'Campus Event')}</div>
        <div class="ticket-pass-code">${escapeHtml(ticket.ticketCode)}</div>
        <div class="ticket-barcode">||| | |||| | || ||| |||| |</div>
        <div class="ticket-pass-time">ISSUED: ${new Date(ticket.createdAt).toLocaleString()}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function openEventModal() {
  if (!state.user) {
    alert('Authentication required to schedule campus events. Please log in.');
    return;
  }
  populateEventClubSelect();
  document.getElementById('event-modal').style.display = 'flex';
}

function closeEventModal() {
  document.getElementById('event-modal').style.display = 'none';
  document.getElementById('create-event-form').reset();
}

function populateEventClubSelect() {
  const select = document.getElementById('new-event-club');
  if (!select) return;
  select.innerHTML = '<option value="">-- SELECT HOSTING CLUB --</option>';
  state.clubs.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (c/${c.slug})`;
    select.appendChild(opt);
  });
}

// ============================================================================
// 11. INITIALIZATION & GLOBAL LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Clock
  setInterval(() => {
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = `UTC ${new Date().toISOString().slice(11, 19)}`;
  }, 1000);

  // Auth
  renderAuthCard();
  renderUserAffiliations();
  renderTicketWallet();

  // Module Tabs Navigation
  document.querySelectorAll('.module-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  // Clubs & Posts
  loadClubs();
  loadPosts();

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentSort = btn.dataset.sort;
      // In-memory sort or query
      if (state.currentSort === 'top') {
        state.posts.sort((a, b) => b.likeCount - a.likeCount);
        renderPosts();
      } else {
        loadPosts();
      }
    });
  });

  // Debounced Live Search with AbortController
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  let searchDebounceTimer = null;
  let searchAbortController = null;

  const triggerLiveSearch = () => {
    if (searchAbortController) {
      searchAbortController.abort(); // Cancel stale in-flight search requests
    }
    searchAbortController = new AbortController();
    state.searchQuery = searchInput.value.trim();
    state.page = 1;
    loadPosts(searchAbortController.signal);
  };

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(triggerLiveSearch, 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(searchDebounceTimer);
      triggerLiveSearch();
    }
  });

  searchBtn.addEventListener('click', () => {
    clearTimeout(searchDebounceTimer);
    triggerLiveSearch();
  });

  // Reset filter
  document.getElementById('clear-filter-btn').addEventListener('click', () => {
    setClubFilter('', '');
  });

  // Modal open/close: Post
  document.getElementById('btn-open-post-modal').addEventListener('click', openPostModal);
  document.getElementById('close-modal-btn').addEventListener('click', closePostModal);
  document.getElementById('cancel-post-btn').addEventListener('click', closePostModal);

  // Modal open/close: Club
  const btnOpenClub = document.getElementById('btn-open-club-modal');
  if (btnOpenClub) btnOpenClub.addEventListener('click', openClubModal);
  const btnCloseClub = document.getElementById('close-club-modal-btn');
  if (btnCloseClub) btnCloseClub.addEventListener('click', closeClubModal);
  const btnCancelClub = document.getElementById('cancel-club-btn');
  if (btnCancelClub) btnCancelClub.addEventListener('click', closeClubModal);

  // Modal open/close: Event
  const btnOpenEvent = document.getElementById('btn-open-event-modal');
  if (btnOpenEvent) btnOpenEvent.addEventListener('click', openEventModal);
  const btnCloseEvent = document.getElementById('close-event-modal-btn');
  if (btnCloseEvent) btnCloseEvent.addEventListener('click', closeEventModal);
  const btnCancelEvent = document.getElementById('cancel-event-btn');
  if (btnCancelEvent) btnCancelEvent.addEventListener('click', closeEventModal);

  // Edit modal close
  document.getElementById('close-edit-modal-btn').addEventListener('click', closeEditModal);
  document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);

  // Profile modal close & submit
  const btnCloseProfile = document.getElementById('close-profile-modal-btn');
  if (btnCloseProfile) btnCloseProfile.addEventListener('click', closeProfileModal);
  const btnCancelProfile = document.getElementById('cancel-profile-btn');
  if (btnCancelProfile) btnCancelProfile.addEventListener('click', closeProfileModal);

  const profileForm = document.getElementById('edit-profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-profile-name').value.trim();
      const avatarUrl = document.getElementById('edit-profile-avatar').value.trim() || null;
      const currentPassword = document.getElementById('edit-profile-curr-pw').value;
      const newPassword = document.getElementById('edit-profile-new-pw').value;

      const payload = {};
      if (name) payload.name = name;
      if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl;
      if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      try {
        const res = await apiRequest('/auth/me', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (res.data?.user) {
          state.user = res.data.user;
          localStorage.setItem('campushub_user', JSON.stringify(state.user));
          renderAuthCard();
          closeProfileModal();
          alert('Profile settings saved successfully!');
        }
      } catch (err) {
        alert(`Profile update failed: ${err.message}`);
      }
    });
  }

  // Submit Create Post Form
  document.getElementById('create-post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clubId = document.getElementById('new-post-club').value;
    const title = document.getElementById('new-post-title').value.trim();
    const content = document.getElementById('new-post-content').value.trim();

    if (!title || !content || !clubId) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, content, tags: [clubId] }),
      });
      closePostModal();
      document.getElementById('create-post-form').reset();
      state.page = 1;
      await loadPosts();
    } catch (err) {
      alert(`Broadcast failed: ${err.message}`);
    }
  });

  // Submit Create Club Form
  const clubForm = document.getElementById('create-club-form');
  if (clubForm) {
    clubForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-club-name').value.trim();
      const description = document.getElementById('new-club-description').value.trim();
      const bannerUrl = document.getElementById('new-club-banner').value.trim() || null;

      try {
        const res = await apiRequest('/clubs', {
          method: 'POST',
          body: JSON.stringify({ name, description, bannerUrl }),
        });
        closeClubModal();
        if (res.data?.club?.id) {
          state.userMemberships.add(res.data.club.id);
        }
        await loadClubs();
        renderClubsDirectory();
        renderUserAffiliations();
        alert(`Club "c/${res.data.club.slug}" chartered successfully! You are assigned as founder/ADMIN.`);
      } catch (err) {
        alert(`Failed to charter club: ${err.message}`);
      }
    });
  }

  // Submit Create Event Form
  const eventForm = document.getElementById('create-event-form');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clubId = document.getElementById('new-event-club').value;
      const title = document.getElementById('new-event-title').value.trim();
      const location = document.getElementById('new-event-location').value.trim();
      const startInput = document.getElementById('new-event-start').value;
      const endInput = document.getElementById('new-event-end').value;
      const capacity = parseInt(document.getElementById('new-event-capacity').value, 10);
      const description = document.getElementById('new-event-description').value.trim();

      if (!clubId || !title || !location || !startInput || !endInput || isNaN(capacity) || !description) {
        alert('Please fill out all required fields.');
        return;
      }

      const startTime = new Date(startInput).toISOString();
      const endTime = new Date(endInput).toISOString();

      if (new Date(endTime) <= new Date(startTime)) {
        alert('End time must be strictly after start time.');
        return;
      }

      try {
        await apiRequest(`/clubs/${clubId}/events`, {
          method: 'POST',
          body: JSON.stringify({ title, location, startTime, endTime, capacity, description }),
        });
        closeEventModal();
        await loadEventsDirectory();
        alert(`Event "${title}" broadcasted and open for high-concurrency ticket registrations!`);
      } catch (err) {
        alert(`Failed to schedule event: ${err.message}`);
      }
    });
  }

  // Submit Edit Form
  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('edit-type').value;
    const itemId = document.getElementById('edit-item-id').value;
    const parentPostId = document.getElementById('edit-parent-post-id').value;
    const content = document.getElementById('edit-content-input').value.trim();

    try {
      if (type === 'post') {
        const title = document.getElementById('edit-title-input').value.trim();
        await apiRequest(`/posts/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, content }),
        });
        await loadPosts();
      } else {
        await apiRequest(`/posts/${parentPostId}/comments/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content }),
        });
        await loadComments(parentPostId);
      }
      closeEditModal();
    } catch (err) {
      alert(`Edit failed: ${err.message}`);
    }
  });

  // Pagination
  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadPosts();
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      loadPosts();
    }
  });

  // Initialize Real-Time Server-Sent Events stream
  initRealtimeStream();
});

// ============================================================================
// 12. REAL-TIME TELEMETRY (SERVER-SENT EVENTS)
// ============================================================================
function initRealtimeStream() {
  const badge = document.getElementById('sse-status-badge');

  try {
    const eventSource = new EventSource('/api/v1/posts/stream');

    eventSource.onopen = () => {
      if (badge) {
        badge.textContent = '[ SSE: LIVE ]';
        badge.className = 'badge green';
      }
    };

    eventSource.onerror = () => {
      if (badge) {
        badge.textContent = '[ SSE: RECONNECTING ]';
        badge.className = 'badge red';
      }
    };

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleRealtimeEvent(payload);
      } catch {
        // Ping comments
      }
    };
  } catch (err) {
    console.warn('Real-time SSE not supported or blocked:', err);
  }
}

function handleRealtimeEvent(payload) {
  const { type, data } = payload;
  if (!data) return;

  switch (type) {
    case 'POST_VOTED': {
      const { postId, likeCount } = data;
      const countEl = document.querySelector(`.post-vote-count[data-post-id="${postId}"]`);
      if (countEl) {
        countEl.textContent = likeCount;
        countEl.classList.add('pulse-highlight');
        setTimeout(() => countEl.classList.remove('pulse-highlight'), 800);
      }
      const post = state.posts.find((p) => p.id === postId);
      if (post) post.likeCount = likeCount;
      break;
    }

    case 'POST_CREATED': {
      const { post } = data;
      if (!post) break;
      if (state.page === 1 && !state.posts.some((p) => p.id === post.id)) {
        state.posts.unshift(post);
        renderPosts();
        const firstPost = document.querySelector(`.post-item[data-post-id="${post.id}"]`);
        if (firstPost) {
          firstPost.classList.add('pulse-highlight');
          setTimeout(() => firstPost.classList.remove('pulse-highlight'), 1200);
        }
      }
      break;
    }

    case 'POST_DELETED': {
      const { postId } = data;
      const post = state.posts.find((p) => p.id === postId);
      if (post) {
        post.isDeleted = true;
        post.content = '[This post was deleted by author]';
        renderPosts();
      }
      break;
    }

    case 'COMMENT_CREATED': {
      const { postId } = data;
      const post = state.posts.find((p) => p.id === postId);
      if (post) {
        post.commentCount = (post.commentCount || 0) + 1;
        const btn = document.querySelector(`.toggle-comments-btn[data-post-id="${postId}"]`);
        if (btn) btn.textContent = `[ ${post.commentCount} COMMENTS ]`;
      }
      if (state.expandedPostId === postId) {
        loadComments(postId);
      }
      break;
    }

    case 'COMMENT_VOTED': {
      const { commentId, likeCount } = data;
      const countEl = document.getElementById(`comment-votes-${commentId}`);
      if (countEl) {
        countEl.textContent = likeCount;
        countEl.classList.add('pulse-highlight');
        setTimeout(() => countEl.classList.remove('pulse-highlight'), 800);
      }
      break;
    }

    case 'COMMENT_DELETED': {
      const { postId } = data;
      if (state.expandedPostId === postId) {
        loadComments(postId);
      }
      break;
    }
  }
}
