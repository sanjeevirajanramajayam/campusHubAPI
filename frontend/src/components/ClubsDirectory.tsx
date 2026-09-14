'use client';

import React, { useState } from 'react';
import { Club, User, apiRequest } from '@/lib/api';

interface ClubsDirectoryProps {
  clubs: Club[];
  currentUser: User | null;
  userMemberships: Set<string>;
  onRefreshClubs: () => void;
  onViewClubFeed: (slug: string) => void;
}

export function ClubsDirectory({
  clubs,
  currentUser,
  userMemberships,
  onRefreshClubs,
  onViewClubFeed,
}: ClubsDirectoryProps) {
  const [showCharterModal, setShowCharterModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  const handleJoin = async (clubId: string) => {
    if (!currentUser) {
      alert('Authentication required to join campus clubs.');
      return;
    }
    try {
      await apiRequest(`/clubs/${clubId}/join`, { method: 'POST' });
      onRefreshClubs();
    } catch (err: any) {
      alert(`Join failed: ${err.message}`);
    }
  };

  const handleLeave = async (clubId: string) => {
    if (!currentUser) return;
    try {
      await apiRequest(`/clubs/${clubId}/leave`, { method: 'DELETE' });
      onRefreshClubs();
    } catch (err: any) {
      alert(`Leave failed: ${err.message}`);
    }
  };

  const handleCharterClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      await apiRequest('/clubs', {
        method: 'POST',
        body: JSON.stringify({ name, description, bannerUrl: bannerUrl || null }),
      });
      setShowCharterModal(false);
      setName('');
      setDescription('');
      setBannerUrl('');
      onRefreshClubs();
      alert('Club chartered successfully!');
    } catch (err: any) {
      alert(`Charter failed: ${err.message}`);
    }
  };

  return (
    <div className="directory-view">
      <div className="directory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 className="section-title">CAMPUS CLUBS &amp; ORGANIZATIONS</h2>
          <p className="section-desc">OFFICIAL CHARTERED STUDENT SOCIETIES</p>
        </div>
        {currentUser && (
          <button className="brutal-btn red-btn" onClick={() => setShowCharterModal(true)}>
            [ + CHARTER NEW CLUB ]
          </button>
        )}
      </div>

      <div className="directory-grid">
        {clubs.map((club) => {
          const isMember = userMemberships.has(club.id);
          const memberCount = club._count?.members || 0;
          return (
            <div key={club.id} className="directory-card">
              <div className="directory-card-header">
                <span className="directory-card-slug">c/{club.slug}</span>
                <span className={`badge ${memberCount > 0 ? 'green' : ''}`}>[ {memberCount} MEMBERS ]</span>
              </div>
              <h3 className="directory-card-title">{club.name}</h3>
              <p className="directory-card-desc">{club.description || 'No charter statement on file.'}</p>
              <div className="directory-card-actions">
                {isMember ? (
                  <button className="brutal-btn mini red-btn" onClick={() => handleLeave(club.id)}>
                    [ LEAVE CLUB ]
                  </button>
                ) : (
                  <button className="brutal-btn mini" onClick={() => handleJoin(club.id)}>
                    [ JOIN CLUB ]
                  </button>
                )}
                <button className="brutal-btn mini" onClick={() => onViewClubFeed(club.slug)}>
                  [ VIEW FEED &gt;&gt; ]
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charter Modal */}
      {showCharterModal && (
        <div className="brutal-modal-overlay">
          <div className="brutal-modal">
            <div className="brutal-modal-header">
              <span>[ CHARTER STUDENT CLUB ]</span>
              <button className="modal-close-btn" onClick={() => setShowCharterModal(false)}>
                X
              </button>
            </div>
            <form onSubmit={handleCharterClub} className="modal-body">
              <label className="form-label">CLUB NAME</label>
              <input
                type="text"
                className="brutal-input"
                placeholder="Autonomous Robotics Society"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label className="form-label">DESCRIPTION</label>
              <textarea
                className="brutal-input"
                rows={3}
                placeholder="Mission statement and meeting times..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <label className="form-label">BANNER URL (OPTIONAL)</label>
              <input
                type="url"
                className="brutal-input"
                placeholder="https://..."
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button type="submit" className="brutal-btn full red-btn">
                  [ SUBMIT CHARTER ]
                </button>
                <button type="button" className="brutal-btn full" onClick={() => setShowCharterModal(false)}>
                  [ CANCEL ]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
