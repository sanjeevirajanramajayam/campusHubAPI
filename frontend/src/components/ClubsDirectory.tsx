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
    <div className="feed-section">
      <div className="section-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div className="section-title-wrap">
          <h2 className="section-heading" style={{ fontSize: '14px', fontWeight: 700 }}>
            [ CAMPUS CLUBS DIRECTORY &amp; CHARTER ]
          </h2>
          <span className="sub-counter text-muted">[{clubs.length} CHARTERED SOCIETIES]</span>
        </div>
        {currentUser && (
          <button className="brutal-btn red-btn mini" onClick={() => setShowCharterModal(true)}>
            + CHARTER CLUB
          </button>
        )}
      </div>

      <div className="cards-grid">
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
              <p className="directory-card-desc">{club.description || 'No charter description.'}</p>
              <div className="directory-card-actions">
                {isMember ? (
                  <button className="brutal-btn mini red-btn" onClick={() => handleLeave(club.id)}>
                    [ LEAVE ]
                  </button>
                ) : (
                  <button className="brutal-btn mini" onClick={() => handleJoin(club.id)}>
                    [ JOIN ]
                  </button>
                )}
                <button className="brutal-btn mini" onClick={() => onViewClubFeed(club.slug)}>
                  [ FEED &gt;&gt; ]
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charter Modal */}
      {showCharterModal && (
        <div className="modal-overlay">
          <div className="modal-box brutal-modal">
            <div className="modal-header">
              <span>[ CHARTER STUDENT CLUB ]</span>
              <button className="close-btn" onClick={() => setShowCharterModal(false)}>
                &times;
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
                className="brutal-textarea"
                rows={3}
                placeholder="Mission statement and weekly meeting schedule..."
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
