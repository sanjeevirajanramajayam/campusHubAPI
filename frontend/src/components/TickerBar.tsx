'use client';

import React, { useEffect, useState } from 'react';
import { SSEStatus } from '@/hooks/useRealtimeFeed';

interface TickerBarProps {
  sseStatus: SSEStatus;
}

export function TickerBar({ sseStatus }: TickerBarProps) {
  const [clock, setClock] = useState<string>('UTC --:--:--');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(`UTC ${now.toISOString().slice(11, 19)}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const badgeClass =
    sseStatus === 'LIVE' ? 'badge green' : sseStatus === 'CONNECTING' ? 'badge' : 'badge red';

  return (
    <div className="ticker-bar">
      <div className="ticker-left">
        <span className="badge red">[ CAMPUS CLUSTER ]</span>
        <span id="sse-status-badge" className={badgeClass}>
          [ SSE: {sseStatus} ]
        </span>
        <span className="pipe">|</span>
        <span className="telemetry-mono text-muted">HOST: 127.0.0.1:5000</span>
        <span className="pipe">|</span>
        <span className="telemetry-mono text-muted">SEC: ARGON2ID + ACID</span>
      </div>
      <div className="ticker-right">
        <span id="clock" className="telemetry-mono">
          {clock}
        </span>
        <span className="pipe">|</span>
        <a href="http://localhost:5000/docs/" target="_blank" rel="noreferrer" className="ticker-link">
          [ API DOCS ]
        </a>
        <span className="pipe">|</span>
        <a
          href="https://github.com/sanjeevirajanramajayam/campusHubAPI"
          target="_blank"
          rel="noreferrer"
          className="ticker-link"
        >
          [ GITHUB ]
        </a>
      </div>
    </div>
  );
}
