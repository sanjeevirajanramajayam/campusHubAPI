'use client';

import React, { useState } from 'react';
import { User, apiRequest } from '@/lib/api';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export function ProfileModal({ user, onClose, onUserUpdated }: ProfileModalProps) {
  const [name, setName] = useState(user.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: any = {};
    if (name.trim()) payload.name = name.trim();
    if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();
    if (currentPassword && newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      const res = await apiRequest<{ user: User }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res?.data?.user) {
        onUserUpdated(res.data.user);
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
          <label className="form-label">OPERATOR CALLSIGN (NAME)</label>
          <input
            type="text"
            className="brutal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
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

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '6px' }}>
            <span className="telemetry-label" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              [ RE-AUTHENTICATE FOR PASSWORD CHANGE ]
            </span>
          </div>

          <label className="form-label">CURRENT PASSWORD</label>
          <input
            type="password"
            className="brutal-input"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <label className="form-label">NEW PASSWORD</label>
          <input
            type="password"
            className="brutal-input"
            placeholder="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
