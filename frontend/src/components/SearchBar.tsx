'use client';

import React, { useState, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string, signal?: AbortSignal) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const triggerSearch = (text: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Cancel previous in-flight request
    }
    abortControllerRef.current = new AbortController();
    onSearch(text, abortControllerRef.current.signal);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      triggerSearch(val.trim());
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      triggerSearch(query.trim());
    }
  };

  return (
    <div className="search-box">
      <input
        type="text"
        id="search-input"
        className="brutal-input"
        placeholder="SEARCH DISPATCHES (DEBOUNCED)..."
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button
        id="search-btn"
        className="brutal-btn"
        onClick={() => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          triggerSearch(query.trim());
        }}
      >
        [ SEARCH ]
      </button>
    </div>
  );
}
