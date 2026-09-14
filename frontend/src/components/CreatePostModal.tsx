'use client';

import React, { useState } from 'react';
import { Club, apiRequest } from '@/lib/api';

interface CreatePostModalProps {
  clubs: Club[];
  onClose: () => void;
  onPostCreated: () => void;
}

export function CreatePostModal({ clubs, onClose, onPostCreated }: CreatePostModalProps) {
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostClub, setNewPostClub] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim() || !newPostClub) {
      alert('Please fill out all fields.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
          tags: [newPostClub],
        }),
      });
      onPostCreated();
      onClose();
    } catch (err: any) {
      alert(`Broadcast failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box brutal-modal">
        <div className="modal-header">
          <span>[ SUBMIT DISPATCH TO FEED ]</span>
          <button className="close-btn" onClick={onClose}>
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
            <button type="submit" className="brutal-btn red-btn" disabled={loading}>
              {loading ? '[ TRANSMITTING... ]' : '[ TRANSMIT DISPATCH ]'}
            </button>
            <button type="button" className="brutal-btn" onClick={onClose}>
              [ CANCEL ]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
