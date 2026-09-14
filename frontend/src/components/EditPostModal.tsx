'use client';

import React, { useState } from 'react';
import { Post, apiRequest } from '@/lib/api';

interface EditPostModalProps {
  post: Post;
  onClose: () => void;
  onPostUpdated: () => void;
}

export function EditPostModal({ post, onClose, onPostUpdated }: EditPostModalProps) {
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [loading, setLoading] = useState(false);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editContent.trim()) return;
    setLoading(true);
    try {
      await apiRequest(`/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
      });
      onPostUpdated();
      onClose();
    } catch (err: any) {
      alert(`Edit failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box brutal-modal">
        <div className="modal-header">
          <span>[ EDIT BROADCAST DISPATCH ]</span>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSaveEdit} className="modal-body">
          <label className="form-label">HEADLINE</label>
          <input
            type="text"
            className="brutal-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />

          <label className="form-label">CONTENT</label>
          <textarea
            className="brutal-textarea"
            rows={4}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            required
          />

          <div className="modal-footer">
            <button type="submit" className="brutal-btn red-btn" disabled={loading}>
              {loading ? '[ SAVING... ]' : '[ SAVE CHANGES ]'}
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
