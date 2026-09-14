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
      {/* VOTE CELL */}
      <div className="vote-cell">
        <button
          className={`vote-arrow up ${post.hasLiked ? 'voted' : ''}`}
          title="Upvote dispatch"
          onClick={() => onVote(post.id)}
        >
          ▲
        </button>
        <span className="post-vote-count" data-post-id={post.id}>
          {post.likeCount}
        </span>
      </div>

      {/* CONTENT CELL */}
      <div className="post-content-cell">
        <div className="post-meta-top">
          <span className="post-channel-chip">c/{channelSlug}</span>
          <span className="pipe">|</span>
          <span className="post-author-name">u/{post.authorName}</span>
          {post.authorRole === 'ADMIN' && <span className="badge red mini">[ ADMIN ]</span>}
          {post.authorRole === 'CLUB_LEAD' && <span className="badge mini">[ LEAD ]</span>}
          <span className="pipe">|</span>
          <span className="telemetry-mono text-muted">{formatTime(post.createdAt)}</span>
        </div>

        <h2 className="post-headline">{post.title}</h2>
        <div className="post-body-text">{post.content}</div>

        <div className="post-tags-list">
          {(post.tags || []).map((tag) => (
            <span key={tag} className="tag-chip">
              #{tag}
            </span>
          ))}
        </div>

        <div className="post-actions-strip">
          <button
            className={`action-btn toggle-comments-btn ${isExpanded ? 'active' : ''}`}
            onClick={() => onToggleComments(post.id)}
          >
            [ {post.commentCount || 0} COMMENTS {isExpanded ? '▲' : '▼'} ]
          </button>

          {isAuthor && (
            <>
              <span className="pipe">|</span>
              <button className="action-btn" onClick={() => onEdit(post)}>
                [ EDIT ]
              </button>
              <span className="pipe">|</span>
              <button className="action-btn text-red" onClick={() => onDelete(post.id)}>
                [ DELETE ]
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
