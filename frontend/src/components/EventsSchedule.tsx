'use client';

import React, { useState } from 'react';
import { EventItem, Ticket, User, apiRequest } from '@/lib/api';

interface EventsScheduleProps {
  events: EventItem[];
  userTickets: Ticket[];
  currentUser: User | null;
  onRefreshEvents: () => void;
  onTicketClaimed: (ticket: Ticket) => void;
}

export function EventsSchedule({
  events,
  userTickets: _userTickets,
  currentUser,
  onRefreshEvents,
  onTicketClaimed,
}: EventsScheduleProps) {
  const [claimingEventId, setClaimingEventId] = useState<string | null>(null);

  const handleClaimTicket = async (eventId: string) => {
    if (!currentUser) {
      alert('Authentication required to register for campus events.');
      return;
    }
    try {
      setClaimingEventId(eventId);
      const res = await apiRequest<{ ticket: Ticket }>(`/events/${eventId}/register`, {
        method: 'POST',
      });
      if (res?.data?.ticket) {
        onTicketClaimed(res.data.ticket);
        onRefreshEvents();
        alert(`RSVP Confirmed! Issued ticket code: ${res.data.ticket.ticketCode}`);
      }
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setClaimingEventId(null);
    }
  };

  return (
    <div className="feed-section">
      <div className="section-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div className="section-title-wrap">
          <h2 className="section-heading" style={{ fontSize: '14px', fontWeight: 700 }}>
            [ CAMPUS EVENTS &amp; HIGH-CONCURRENCY TICKETING ]
          </h2>
          <span className="sub-counter text-muted">[{events.length} ACTIVE EVENTS]</span>
        </div>
      </div>

      {/* Events Grid */}
      <div className="cards-grid">
        {events.map((event) => {
          const isSoldOut = event.registeredCount >= event.capacity;
          const pct = Math.min(100, Math.round((event.registeredCount / event.capacity) * 100));

          return (
            <div key={event.id} className="directory-card">
              <div className="directory-card-header">
                <span className="telemetry-mono text-muted">{event.location}</span>
                <span className={`badge ${isSoldOut ? 'red' : 'green'}`}>
                  [ {event.registeredCount} / {event.capacity} SEATS ]
                </span>
              </div>

              <h3 className="directory-card-title">{event.title}</h3>
              <p className="directory-card-desc">{event.description}</p>

              {/* Capacity Bar */}
              <div className="capacity-bar-container" style={{ margin: '10px 0' }}>
                <div
                  className={`capacity-bar-fill ${isSoldOut ? 'full' : ''}`}
                  style={{ width: `${pct}%`, height: '6px', background: isSoldOut ? 'var(--accent-red)' : 'var(--accent-green)' }}
                />
              </div>

              <div className="directory-card-actions">
                <button
                  className={`brutal-btn full ${isSoldOut ? 'disabled' : 'red-btn'}`}
                  disabled={isSoldOut || claimingEventId === event.id}
                  onClick={() => handleClaimTicket(event.id)}
                >
                  {claimingEventId === event.id
                    ? '[ ACQUIRING ROW LOCK... ]'
                    : isSoldOut
                    ? '[ EVENT SOLD OUT ]'
                    : '[ CLAIM ADMISSION PASS ]'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
