/**
 * CAMPUSHUB TYPED API CLIENT FOR NEXT.JS
 * 
 * NEXT.JS CONCEPT: Universal Execution (Client vs Server)
 * - Next.js runs code on both the server (Node.js during SSR) and client (Browser).
 * - On the server, `window` and `localStorage` do NOT exist.
 * - Always guard browser-only APIs using `typeof window !== 'undefined'`.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'ADMIN' | 'CLUB_LEAD';
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  clubId?: string | null;
  clubSlug?: string | null;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  tags: string[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  hasLiked?: boolean;
}

export interface CommentNode {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  isDeleted: boolean;
  depth: number;
  createdAt: string;
  replies?: CommentNode[];
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  createdAt: string;
  _count?: {
    members: number;
  };
}

export interface EventItem {
  id: string;
  clubId: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  capacity: number;
  registeredCount: number;
  createdAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle?: string;
  ticketCode: string;
  createdAt: string;
}

/**
 * Universal typed API request helper
 * Routes through Next.js proxy rewrite `/api/v1/*` -> `http://localhost:5000/api/v1/*`
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T> | null> {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Next.js Safety: Check if running inside browser before accessing localStorage
  const isBrowser = typeof window !== 'undefined';
  const token = isBrowser ? localStorage.getItem('campushub_token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`/api/v1${cleanPath}`, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await res.json();

    if (!res.ok) {
      if (res.status === 401 && isBrowser) {
        localStorage.removeItem('campushub_token');
        localStorage.removeItem('campushub_user');
      }
      const errorMsg =
        data.error?.message ||
        data.message ||
        'API request failed';
      throw new Error(errorMsg);
    }

    return data;
  } catch (err: any) {
    // Next.js / Fetch: Don't throw if request was intentionally aborted by user debouncing
    if (err.name === 'AbortError') {
      return null;
    }
    console.error(`[API ERROR] ${cleanPath}:`, err.message);
    throw err;
  }
}
