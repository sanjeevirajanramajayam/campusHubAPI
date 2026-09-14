'use client';

import React from 'react';
import { Club } from '@/lib/api';

interface SubredditNavProps {
  clubs: Club[];
  currentClubId: string;
  onSelectClub: (clubSlug: string) => void;
}

export function SubredditNav({ clubs, currentClubId, onSelectClub }: SubredditNavProps) {
  return (
    <nav className="club-nav" id="club-nav-bar">
      <span className="nav-prefix">CHANNELS &gt;&gt;</span>
      <button
        className={`club-chip brutal-reset ${currentClubId === '' ? 'active' : ''}`}
        onClick={() => onSelectClub('')}
      >
        c/all
      </button>

      {clubs.map((club) => {
        const slug = (club.slug || club.name.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
        const isActive = currentClubId === slug;
        return (
          <button
            key={club.id}
            className={`club-chip brutal-reset ${isActive ? 'active' : ''}`}
            onClick={() => onSelectClub(slug)}
          >
            c/{slug}
          </button>
        );
      })}
    </nav>
  );
}
