'use client';

import React from 'react';
import { Post, User } from '@/lib/api';

interface PostCardProps {
  post: Post;
  currentUser: User | null;
  isExpanded: boolean;
  onVote: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onEdit: (post: Post) => void;
  onDelete: (postId: string) => void;
}

export function PostCard({
  post,
  currentUser,
  isExpanded,
  onVote,
  onToggleComments,
  onEdit,
  onDelete,
}: PostCardProps) {
  const isAuthor = currentUser && (currentUser.id === post.authorId || currentUser.role === 'ADMIN');

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const channelSlug = post.clubSlug || (post.tags?.[0] ? post.tags[0] : 'all');

  return (
    <article className="post-item" data-post-id={post.id}>
      {/* 1. LEFT VOTE COLUMN */}
      <div className="vote-col">
        <button
          className={`vote-btn ${post.hasLiked ? 'upvoted' : ''}`}
          title="Upvote dispatch"
          onClick={() => onVote(post.id)}
        >
          ▲
        </button>
        <span className={`vote-count ${post.hasLiked ? 'upvoted' : ''}`}>
          {post.likeCount}
        </span>
      </div>

      {/* 2. RIGHT MAIN CONTENT COLUMN */}
      <div className="post-main">
        <div className="post-header-line">
          <span className="post-badge">c/{channelSlug}</span>
          <h2 className="post-title" onClick={() => onToggleComments(post.id)}>
            {post.title}
          </h2>
        </div>

        <div className="post-meta">
          Submitted by <strong>u/{post.authorName}</strong>{' '}
          {post.authorRole === 'ADMIN' && <span className="badge red">[ADMIN]</span>}{' '}
          {post.authorRole === 'CLUB_LEAD' && <span className="badge">[LEAD]</span>}{' '}
          <span className="pipe">|</span> {formatTime(post.createdAt)}
        </div>

        <div className={`post-body ${post.isDeleted ? 'tombstone' : ''}`}>
          {post.content}
        </div>

        <div className="post-actions">
          <button className="action-link" onClick={() => onToggleComments(post.id)}>
            [ {post.commentCount || 0} COMMENTS {isExpanded ? '▲' : '▼'} ]
          </button>

          {isAuthor && !post.isDeleted && (
            <>
              <span className="pipe">|</span>
              <button className="action-link" onClick={() => onEdit(post)}>
                [ EDIT ]
              </button>
              <span className="pipe">|</span>
              <button className="action-link delete" onClick={() => onDelete(post.id)}>
                [ DELETE ]
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
