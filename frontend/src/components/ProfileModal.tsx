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
    <div className="brutal-modal-overlay">
      <div className="brutal-modal">
        <div className="brutal-modal-header">
          <span>[ EDIT OPERATOR PROFILE TELEMETRY ]</span>
          <button className="modal-close-btn" onClick={onClose}>
            X
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <label className="form-label">OPERATOR CALLSIGN (FULL NAME)</label>
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

          <div style={{ margin: '16px 0 8px 0', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <span className="telemetry-mono text-muted">[ RE-AUTHENTICATE FOR PASSWORD CHANGE ]</span>
          </div>

          <label className="form-label">CURRENT PASSWORD</label>
          <input
            type="password"
            className="brutal-input"
            placeholder="Required only to set new password"
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

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button type="submit" className="brutal-btn full red-btn" disabled={loading}>
              {loading ? '[ PERSISTING... ]' : '[ SAVE SETTINGS ]'}
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
