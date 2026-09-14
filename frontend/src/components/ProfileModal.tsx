'use client';

import React, { useState } from 'react';
import { User, apiRequest } from '@/lib/api';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export function ProfileModal({ user, onClose, onUserUpdated }: ProfileModalProps) {
  const [firstName, setFirstName] = useState(user.firstName || user.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user.lastName || user.name?.split(' ').slice(1).join(' ') || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: any = {};
    if (firstName.trim()) payload.firstName = firstName.trim();
    if (lastName.trim()) payload.lastName = lastName.trim();
    if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();

    try {
      const res = await apiRequest<{ user: User }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res?.data?.user) {
        const updated = {
          ...res.data.user,
          name: `${res.data.user.firstName || ''} ${res.data.user.lastName || ''}`.trim(),
        };
        localStorage.setItem('campushub_user', JSON.stringify(updated));
        onUserUpdated(updated);
        onClose();
        alert('Profile telemetry updated successfully!');
      }
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="brutal-modal">
        <div className="modal-header">
          <span>[ OPERATOR PROFILE SETTINGS ]</span>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="form-label">FIRST NAME</label>
          <input
            type="text"
            className="brutal-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />

          <label className="form-label">LAST NAME</label>
          <input
            type="text"
            className="brutal-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />

          <label className="form-label">AVATAR URL (OPTIONAL)</label>
          <input
            type="url"
            className="brutal-input"
            placeholder="https://..."
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button type="submit" className="brutal-btn full red-btn" disabled={loading}>
              {loading ? '[ SAVING... ]' : '[ SAVE SETTINGS ]'}
            </button>
            <button type="button" className="brutal-btn full" onClick={onClose}>
              [ CANCEL ]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
