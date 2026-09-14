/**
 * CAMPUSHUB TYPED API CLIENT FOR NEXT.JS
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
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  authorName?: string;
  authorRole?: string;
  clubId?: string | null;
  clubSlug?: string | null;
  title: string;
  content: string;
  likeCount?: number;
  commentCount?: number;
  _count?: {
    likes: number;
    comments: number;
  };
  tags: string[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  hasLiked?: boolean;
  isLikedByCaller?: boolean;
}

export interface CommentNode {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
  };
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
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T> | null> {
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
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
    if (err.name === 'AbortError') {
      return null;
    }
    console.error(`[API ERROR] ${cleanPath}:`, err.message);
    throw err;
  }
}
