'use client';

/**
 * NEXT.JS CONCEPT: 'use client' Directive
 * - Next.js App Router components are Server Components by default.
 * - Server Components cannot use hooks (useState, useEffect) or browser APIs (EventSource).
 * - Putting 'use client' at the top instructs Next.js to compile this code for the browser.
 */

import { useEffect, useState } from 'react';

export type SSEStatus = 'CONNECTING' | 'LIVE' | 'DISCONNECTED';

export interface RealtimeFeedPayload {
  type:
    | 'POST_VOTED'
    | 'POST_CREATED'
    | 'POST_DELETED'
    | 'COMMENT_CREATED'
    | 'COMMENT_VOTED'
    | 'COMMENT_DELETED';
  data: any;
}

export function useRealtimeFeed(onEvent?: (payload: RealtimeFeedPayload) => void) {
  const [status, setStatus] = useState<SSEStatus>('CONNECTING');

  useEffect(() => {
    // Only connect inside browser environment
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource('/api/v1/posts/stream');

      eventSource.onopen = () => {
        setStatus('LIVE');
      };

      eventSource.onerror = () => {
        setStatus('DISCONNECTED');
      };

      eventSource.onmessage = (e) => {
        try {
          const payload: RealtimeFeedPayload = JSON.parse(e.data);
          if (onEvent) {
            onEvent(payload);
          }
        } catch {
          // Ignore heartbeat ping comments
        }
      };
    } catch (err) {
      console.warn('[SSE] Connection failed:', err);
      setStatus('DISCONNECTED');
    }

    // NEXT.JS / REACT CLEANUP: Always close network streams when component unmounts
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [onEvent]);

  return { status };
}
