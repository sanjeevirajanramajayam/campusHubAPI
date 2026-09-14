# CampusHub: Next.js 15 Frontend Migration Master Guide
### Complete Step-by-Step, Line-by-Line Architectural Blueprint

---

## 1. Architectural Strategy: Decoupled API + Next.js App Router

### Why Keep Express on Port 5000 and Next.js on Port 3000?
* **Clean Architecture Separation**: The Express backend acts as the single source of truth for business rules (`Prisma`, `PostgreSQL`, `Argon2id`, `Redis rate limiting`, `SELECT ... FOR UPDATE` pessimistic locks).
* **Zero Disruption to Backend Tests**: All 67 unit tests, concurrency tests, and OpenAPI/Swagger documentation (`/docs/`) remain 100% untouched.
* **Modern React 15 Ecosystem**: The Next.js frontend unlocks React Server Components (RSC), static metadata for SEO, and typed component trees while replacing the monolithic 1,670-line `public/app.js`.

---

## 2. Step 1: Project Scaffolding & Proxy Configuration

### Terminal Command:
```bash
npx -y create-next-app@latest frontend --typescript --no-tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

### Line-by-Line: `frontend/next.config.ts`
Reverse-proxies all `/api/v1/*` requests to the Express backend to eliminate CORS issues and avoid hardcoding localhost ports in client components:

```typescript
// Line 1: Import Next.js configuration type definition
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Line 2: Declare async rewrites to route API calls directly to Express
  async rewrites() {
    return [
      {
        // Line 3: Match any incoming path starting with /api/v1/
        source: '/api/v1/:path*',
        // Line 4: Forward the HTTP request transparently to the Express server running on port 5000
        destination: 'http://localhost:5000/api/v1/:path*',
      },
    ];
  },
};

// Line 5: Export configuration object as default
export default nextConfig;
```

---

## 3. Step 2: Brutalist Design System Migration (`globals.css`)

### Line-by-Line: `frontend/src/styles/globals.css`
Ports the tactical newsprint substrate, monospaced typography, and high-contrast brutalist tokens:

```css
/* Line 1: Global CSS variable tokens defining the industrial aesthetic */
:root {
  --bg-primary: #F4F4F0;       /* Line 2: Unbleached tactical newsprint substrate */
  --bg-surface: #FFFFFF;       /* Line 3: Card surface white */
  --border-color: #111111;     /* Line 4: High-contrast carbon ink border */
  --text-main: #111111;        /* Line 5: Primary high-legibility ink */
  --text-muted: #666666;       /* Line 6: Muted secondary telemetry text */
  --accent-red: #D32F2F;       /* Line 7: Industrial signal red for alerts & logout */
  --accent-green: #2E7D32;     /* Line 8: Live telemetry pulse green for SSE status */
  --accent-yellow: #FBC02D;    /* Line 9: Warning indicator */
  --font-mono: 'JetBrains Mono', 'Courier New', monospace; /* Line 10: Monospace font */
}

/* Line 11: Universal box-sizing and zero rounded corners */
* {
  box-sizing: border-box;
  border-radius: 0px !important; /* Line 12: Enforce strict brutalist 0px radius */
}

/* Line 13: Base document styling */
body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Line 14: Reusable industrial tactical button */
.brutal-btn {
  background: var(--bg-surface);
  color: var(--text-main);
  border: 2px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  padding: 8px 14px;
  cursor: pointer;
  text-transform: uppercase;
}

/* Line 15: Tactile press interaction */
.brutal-btn:active {
  background: var(--border-color);
  color: var(--bg-surface);
}
```

---

## 4. Step 3: Typed API Client (`frontend/src/lib/api.ts`)

### Line-by-Line Explanation:
Handles typed requests, Bearer token injection from browser storage, and native `AbortError` suppression:

```typescript
// Line 1: Define generic API response contract matching Express JSend payload
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

// Line 2: Universal typed HTTP fetch wrapper
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T> | null> {
  // Line 3: Ensure endpoint has a leading slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Line 4: Retrieve JWT token from browser local storage
  const token = typeof window !== 'undefined' ? localStorage.getItem('campushub_token') : null;

  // Line 5: Assemble HTTP headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Line 6: Attach Bearer authorization header if token exists
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Line 7: Execute request through Next.js proxy route
    const res = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
    });

    // Line 8: Parse response body as JSON
    const data: ApiResponse<T> = await res.json();

    // Line 9: Handle non-2xx HTTP status codes
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        // Line 10: Automatically clear expired credentials on 401 Unauthorized
        localStorage.removeItem('campushub_token');
        localStorage.removeItem('campushub_user');
      }
      throw new Error(data.error?.message || data.message || 'API request failed');
    }

    return data;
  } catch (err: any) {
    // Line 11: Suppress AbortError triggered by debounced search cancellation
    if (err.name === 'AbortError') {
      return null;
    }
    console.error(`[API ERROR] ${path}:`, err);
    throw err;
  }
}
```

---

## 5. Step 4: Real-Time Telemetry Hook (`frontend/src/hooks/useRealtimeFeed.ts`)

### Line-by-Line Explanation:
Subscribes to `/api/v1/posts/stream` (SSE) and exposes real-time upvotes, dispatches, and connection status:

```typescript
// Line 1: Mark as client-only hook in Next.js App Router
'use client';

import { useEffect, useState } from 'react';

export type SSEStatus = 'CONNECTING' | 'LIVE' | 'DISCONNECTED';

export interface FeedEventPayload {
  type: 'POST_VOTED' | 'POST_CREATED' | 'POST_DELETED' | 'COMMENT_CREATED';
  data: any;
}

export function useRealtimeFeed(onEvent: (event: FeedEventPayload) => void) {
  // Line 2: Track reactive connection status
  const [status, setStatus] = useState<SSEStatus>('CONNECTING');

  useEffect(() => {
    // Line 3: Establish native EventSource connection to Express SSE endpoint
    const eventSource = new EventSource('/api/v1/posts/stream');

    // Line 4: Transition to LIVE badge on successful handshake
    eventSource.onopen = () => setStatus('LIVE');

    // Line 5: Handle network disconnects and auto-reconnect
    eventSource.onerror = () => setStatus('DISCONNECTED');

    // Line 6: Receive pushed broadcast messages from Redis Pub/Sub
    eventSource.onmessage = (e) => {
      try {
        const payload: FeedEventPayload = JSON.parse(e.data);
        onEvent(payload); // Line 7: Fire callback to update React state
      } catch {
        // Ignore keep-alive heartbeat ping comments
      }
    };

    // Line 8: Cleanup connection when component unmounts
    return () => {
      eventSource.close();
    };
  }, [onEvent]);

  return { status };
}
```

---

## 6. Step 5: Live Search Component (`frontend/src/components/SearchBar.tsx`)

### Line-by-Line Explanation:
Combines 300ms keystroke debouncing with `AbortController` cancellation to eliminate race conditions:

```typescript
// Line 1: Declare client component
'use client';

import { useState, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string, signal: AbortSignal) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  // Line 2: Keep persistent references to timeout ID and active AbortController
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeSearch = (value: string) => {
    // Line 3: Cancel in-flight network request if previous search hasn't finished
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Line 4: Create new AbortController instance for this specific search query
    abortControllerRef.current = new AbortController();
    onSearch(value.trim(), abortControllerRef.current.signal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Line 5: Clear pending debounce timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Line 6: Trigger search after 300ms idle delay
    timerRef.current = setTimeout(() => {
      executeSearch(value);
    }, 300);
  };

  return (
    <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
      <input
        type="text"
        className="brutal-input"
        placeholder="SEARCH DISPATCHES (DEBOUNCED)..."
        value={query}
        onChange={handleInputChange}
        style={{ flex: 1, padding: '8px', border: '2px solid #111' }}
      />
      <button className="brutal-btn" onClick={() => executeSearch(query)}>
        [ SEARCH ]
      </button>
    </div>
  );
}
```

---

## 7. Step 6: Monorepo Scripts (`package.json`)

To launch both backend and Next.js frontend with a single command:

```json
"scripts": {
  "dev:backend": "tsx watch src/server.ts",
  "dev:frontend": "pnpm --filter frontend dev",
  "dev:all": "concurrently \"pnpm run dev:backend\" \"pnpm run dev:frontend\""
}
```

---

---

## 8. Next.js Core Built-in Components Reference

Next.js provides native, highly optimized built-in components that replace standard HTML tags:

| Component | HTML Equivalent | Key Performance / UX Superpower |
| :--- | :--- | :--- |
| `<Link href="...">` | `<a href="...">` | **Client-side prefetching**: Automatically prefetches code for linked routes in the background when the link enters the viewport. Navigation happens with **0ms latency** without a full browser reload. |
| `<Image src="..." />` | `<img src="..." />` | **Zero Layout Shift (CLS)**: Automatically resizes, compresses to modern AVIF/WebP formats, and prevents jarring page jumps while loading. |
| `<Script src="..." />` | `<script src="...">` | **Non-blocking execution**: Uses `strategy="lazyOnload"` or `strategy="afterInteractive"` so external scripts (analytics, widgets) never freeze page rendering. |
| `<Form action="...">` | `<form action="...">` | **Progressive Enhancement**: Works seamlessly before JavaScript even finishes loading in the browser, submitting directly to Server Actions. |
| `<Suspense fallback={...}>` | React Boundary | **Streaming SSR**: Streams HTML chunks directly to the student's screen. Renders a fast brutalist skeleton while heavy database queries resolve. |

### Special Next.js File-Based Components
In the Next.js App Router, specific file names automatically configure layout and routing behavior:
1. `layout.tsx`: Persistent master shell wrapping all child pages (preserves state across route changes).
2. `page.tsx`: Unique UI rendered for a specific URL route (e.g. `/` or `/clubs`).
3. `loading.tsx`: Instant loading skeleton displayed automatically via React Suspense during navigation.
4. `error.tsx`: Catch-all client error boundary that recovers from runtime crashes without breaking the whole app.
5. `not-found.tsx`: Custom 404 page rendered when `notFound()` is thrown.

---

## 9. CampusHub Application Component Architecture

To eliminate the monolithic 1,670-line `public/app.js`, CampusHub decomposes into 8 decoupled, single-responsibility React components:

```
frontend/src/
├── app/
│   ├── layout.tsx              # Master Frame + CSS Tokens
│   ├── page.tsx                # Dynamic Feed / Clubs / Events Orchestrator
│   └── globals.css             # Brutalist Newsprint Substrate (#F4F4F0)
└── components/
    ├── TickerBar.tsx           # 1. Top Telemetry, UTC Clock & [SSE: LIVE] Badge
    ├── SubredditNav.tsx        # 2. Old-Reddit Style Horizontal Channel Chips
    ├── PostCard.tsx            # 3. Brutalist Post Item with Upvote Counter
    ├── CommentDrawer.tsx       # 4. Recursive 3-Level Threaded Comment Tree
    ├── SearchBar.tsx           # 5. 300ms Debounce + AbortController Cancellation
    ├── ClubsDirectory.tsx      # 6. Organization Roster & Charter Form
    ├── EventsSchedule.tsx      # 7. Concurrency Ticket Claim & Pass Wallet
    └── ProfileModal.tsx        # 8. Argon2id Password & Profile Editor
```

### Component Breakdown & Responsibilities:

#### 1. `<TickerBar />` (`components/TickerBar.tsx`)
* **Role**: Industrial top bar showing UTC timestamp, active session status, and real-time SSE connectivity badge (`[ SSE: LIVE ]` vs `[ SSE: RECONNECTING ]`).

#### 2. `<SubredditNav />` (`components/SubredditNav.tsx`)
* **Role**: Horizontal channel switcher (`c/all`, `c/engineering`, `c/design`) with tactile hover borders and active channel filtering.

#### 3. `<PostCard />` (`components/PostCard.tsx`)
* **Role**: Displays individual dispatches with author badges (`u/alex (ADMIN)`), relative timestamps (`2m ago`), tags, and optimistic upvote toggling.

#### 4. `<CommentDrawer />` (`components/CommentDrawer.tsx`)
* **Role**: Renders threaded comment trees up to the maximum 3-level depth (`BR-COMM-003`). Displays `[This comment was deleted by author]` soft-delete tombstones (`BR-COMM-004`).

#### 5. `<SearchBar />` (`components/SearchBar.tsx`)
* **Role**: Traps search keystrokes, clears previous debounce timers, and fires an `AbortController.abort()` signal to cancel in-flight queries during typing.

#### 6. `<ClubsDirectory />` (`components/ClubsDirectory.tsx`)
* **Role**: Grid of student clubs with member counts, `[ JOIN CLUB ]` / `[ LEAVE CLUB ]` mutations, and the club charter modal.

#### 7. `<EventsSchedule />` (`components/EventsSchedule.tsx`)
* **Role**: Displays event capacity bars and the `[ CLAIM TICKET ]` button connected to the high-concurrency PostgreSQL row-locking backend (`SELECT ... FOR UPDATE`). Renders issued barcode passes in the ticket wallet.

#### 8. `<ProfileModal />` (`components/ProfileModal.tsx`)
* **Role**: Protected self-service profile editor hitting `PATCH /api/v1/auth/me`. Enforces Argon2id current-password verification before saving credential changes.

---

---

## 11. Deep-Dive: How React Server Components (RSC) Send 0 KB of JavaScript

### The Code Pattern:
```typescript
// frontend/src/app/feed/page.tsx (Server Component)
export default async function FeedPage() {
  // Step 1: Executes directly on Node.js server!
  const posts = await getPostsFromDatabase(); 

  // Step 2: Returns React JSX elements
  return (
    <div className="posts-container">
      {posts.map((post) => (
        <article key={post.id} className="post-item">
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

### How It Works Under the Hood (Step-by-Step Architecture)

```
[BROWSER]                              [NEXT.JS SERVER (Node.js)]              [POSTGRESQL DB]
   |                                               |                                  |
   | --- 1. GET /feed ---------------------------> |                                  |
   |                                               | --- 2. SELECT * FROM posts ----> |
   |                                               | <--- 3. Returns Row Tuples ----- |
   |                                               |                                  |
   |                                        [Executes JSX]                            |
   |                                        Converts JSX into                         |
   |                                        Static HTML String                        |
   |                                               |                                  |
   | <--- 4. Transmits Raw HTML Stream ----------- |                                  |
   |      (0 bytes of JS for FeedPage!)            |                                  |
   |                                                                                  |
[Renders HTML Immediately]                                                            |
(No JS Hydration, No Virtual DOM Diffing)                                             |
```

#### Step 1: Server-Side Execution (Node.js)
* When a student requests `GET /feed`, Next.js invokes `FeedPage()` **strictly inside the server environment**.
* Because it is an `async` function, it can directly call PostgreSQL queries or secure internal microservices without needing an intermediate client-side `fetch()`, `useEffect()`, or loading spinner.

#### Step 2: Serialization into the RSC Wire Format
* Next.js evaluates the JSX and serializes the output into a lightweight format (the **React Flight Payload**).
* It does **not** compile the component's JavaScript logic (loops, functions, variables) to be shipped to the browser. Only the rendered HTML and data primitives are serialized.

#### Step 3: Zero-Hydration Client Delivery (0 KB JS)
* In traditional Single Page Apps (Vite / CRA), the browser downloads the component's `.js` file, parses it, and executes **Hydration** (attaching event listeners and creating Virtual DOM nodes in memory).
* In Next.js Server Components, **no JavaScript bundle is downloaded for `FeedPage`**. The browser receives pure, ready-to-render HTML.

---

### Why This is a Massive Engineering Advantage

1. **Massive Bundle Size Reduction**:
   * If you use heavy npm packages like `marked` (Markdown parsing, 50KB) or `date-fns` (time formatting, 30KB) inside a Server Component, **0 KB of that library code reaches the browser**. The server parses the markdown, formats the date, and sends only the final HTML text string.
2. **Zero Waterfall API Chains**:
   * In Vanilla JS / Vite: Browser downloads HTML $\rightarrow$ downloads JS $\rightarrow$ runs JS $\rightarrow$ fires `fetch(/api/posts)` $\rightarrow$ waits for DB $\rightarrow$ paints UI (A 4-roundtrip waterfall).
   * In Next.js RSC: Browser requests page $\rightarrow$ Server queries DB $\rightarrow$ returns painted HTML in **1 single roundtrip**.
3. **Ironclad Database & Secret Security**:
   * Secrets (`DATABASE_URL`, API keys, internal tokens) live exclusively in server memory. They can never be inspected in the browser's DevTools Network tab or decompiled from client source maps.

---

---

## 12. Dual-Server Execution & Production Cloud Deployment Architecture

### The Core Principle: We Never Modify the Express Backend
* Express (Port 5000) remains the single source of truth for business logic, Redis rate limiting, and PostgreSQL row-locking.
* Next.js (Port 3000) is an independent Node.js server that acts as the presentation engine.

```
                  THE INTERNET (Students & Mobile Devices)
                                     │
                 ┌───────────────────┴───────────────────┐
                 │ (Opens https://campushub.com)         │ (Direct API calls: /api/v1)
                 ▼                                       ▼
       [SERVICE 1: NEXT.JS]                    [SERVICE 2: EXPRESS API]
       Hosted on: Vercel / Render              Hosted on: Render / AWS / Railway
       Domain: https://campushub.com           Domain: https://api.campushub.com
                 │                                       │
                 │ (Internal Server-to-Server)           │ (Database queries)
                 └──────────────────────────────────────►│
                                                         ▼
                                               [PostgreSQL + Redis]
```

### Local Development vs. Production Cloud Deployment

| Environment | Service 1: Next.js Frontend | Service 2: Express Backend API | How They Talk |
| :--- | :--- | :--- | :--- |
| **Localhost (Dev)** | `http://localhost:3000` (Node process #2) | `http://localhost:5000` (Node process #1) | `next.config.ts` rewrites `/api/v1/:path*` to `localhost:5000` |
| **Production Cloud** | `https://campushub.edu` (Vercel / Render) | `https://api.campushub.edu` (Render / AWS) | `NEXT_PUBLIC_API_URL` environment variable |

### 3 Production Advantages of Decoupled Architecture
1. **Independent Elastic Scaling**: Under heavy traffic spikes, Next.js auto-scales horizontally across edge serverless instances to serve cached HTML. Express handles only the high-value database mutations.
2. **Zero-Downtime UI Updates**: Frontend redesigns, CSS tweaks, or copy changes deploy in 30 seconds without restarting the Express backend or disrupting active WebSocket/SSE connections.
3. **Multi-Platform API Reuse**: A future mobile app (React Native / iOS) connects directly to `https://api.campushub.edu` sharing the exact same authentication and data layer.

---

## 13. Summary Checklist
1. Express API operates on port 5000 with complete ACID row-locking and Redis rate-limiting intact.
2. Next.js App Router runs on port 3000 with clean, typed React components.
3. `/api/v1` calls route seamlessly via Next.js rewrites without CORS issues.
4. Brutalist UI aesthetics remain pixel-perfect with 0px borders and high-density telemetry.
5. React Server Components stream pure HTML with 0 KB JavaScript footprint for static layouts.
6. Decoupled deployment enables independent scaling and zero-downtime updates in production.



