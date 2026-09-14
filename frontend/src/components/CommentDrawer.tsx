'use client';

import React, { useState, useEffect } from 'react';
import { CommentNode, User, apiRequest } from '@/lib/api';

interface CommentDrawerProps {
  postId: string;
  currentUser: User | null;
  onCommentCountChange: (postId: string, newCount: number) => void;
}

export function CommentDrawer({ postId, currentUser, onCommentCountChange }: CommentDrawerProps) {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ comments: CommentNode[] }>(`/posts/${postId}/comments`);
      if (res?.data?.comments) {
        setComments(res.data.comments);
      }
    } catch (err: any) {
      console.warn('Failed to load comments:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleCreateComment = async (parentId: string | null = null, content: string) => {
    if (!currentUser) {
      alert('Authentication required to submit comments.');
      return;
    }
    if (!content.trim()) return;

    try {
      await apiRequest(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), parentId }),
      });
      if (parentId) {
        setReplyingToId(null);
        setReplyText('');
      } else {
        setNewCommentText('');
      }
      await fetchComments();
      onCommentCountChange(postId, comments.length + 1);
    } catch (err: any) {
      alert(`Comment failed: ${err.message}`);
    }
  };

  const handleVoteComment = async (commentId: string) => {
    if (!currentUser) {
      alert('Authentication required to vote.');
      return;
    }
    try {
      await apiRequest(`/posts/${postId}/comments/${commentId}/like`, { method: 'POST' });
      await fetchComments();
    } catch (err: any) {
      alert(`Vote failed: ${err.message}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
    if (!confirm('Soft-delete this comment? Content will be masked with tombstone.')) return;
    try {
      await apiRequest(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      await fetchComments();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const renderCommentItem = (item: CommentNode) => {
    const isAuthor = currentUser && (currentUser.id === item.authorId || currentUser.role === 'ADMIN');
    const canReply = item.depth < 3; // Business Rule: Max 3-level depth

    return (
      <div key={item.id} className={`comment-node depth-${item.depth}`}>
        <div className="comment-header">
          <span className="telemetry-mono">u/{item.authorName}</span>
          <span className="pipe">|</span>
          <span className="telemetry-mono text-muted">{new Date(item.createdAt).toLocaleTimeString()}</span>
          {item.isDeleted && <span className="badge red mini">[ TOMBSTONE ]</span>}
        </div>

        <div className={`comment-body ${item.isDeleted ? 'text-muted italic' : ''}`}>
          {item.content}
        </div>

        <div className="comment-actions">
          {!item.isDeleted && (
            <button className="action-btn mini" onClick={() => handleVoteComment(item.id)}>
              [ ▲ {item.likeCount} ]
            </button>
          )}

          {canReply && !item.isDeleted && (
            <>
              <span className="pipe">|</span>
              <button
                className="action-btn mini"
                onClick={() => setReplyingToId(replyingToId === item.id ? null : item.id)}
              >
                [ REPLY ]
              </button>
            </>
          )}

          {isAuthor && !item.isDeleted && (
            <>
              <span className="pipe">|</span>
              <button className="action-btn mini text-red" onClick={() => handleDeleteComment(item.id)}>
                [ DELETE ]
              </button>
            </>
          )}
        </div>

        {/* Reply form */}
        {replyingToId === item.id && (
          <div className="reply-form" style={{ marginTop: '8px', paddingLeft: '12px' }}>
            <textarea
              className="brutal-input"
              rows={2}
              placeholder="ENTER REPLY..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              style={{ width: '100%', marginBottom: '4px' }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="brutal-btn mini" onClick={() => handleCreateComment(item.id, replyText)}>
                [ SUBMIT REPLY ]
              </button>
              <button className="brutal-btn mini red-btn" onClick={() => setReplyingToId(null)}>
                [ CANCEL ]
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {item.replies && item.replies.length > 0 && (
          <div className="nested-replies" style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '8px' }}>
            {item.replies.map((reply) => renderCommentItem(reply))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="comment-drawer">
      <div className="comment-drawer-header">
        <span className="telemetry-mono font-bold">[ THREADED DISCUSSION TELEMETRY ]</span>
        <span className="telemetry-mono text-muted">(MAX DEPTH: 3 LEVELS)</span>
      </div>

      {/* Top-level comment box */}
      <div className="comment-form-box">
        <textarea
          className="brutal-input"
          rows={2}
          placeholder="DISPATCH TELEMETRY COMMENT..."
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          style={{ width: '100%', marginBottom: '6px' }}
        />
        <button className="brutal-btn" onClick={() => handleCreateComment(null, newCommentText)}>
          [ TRANSMIT COMMENT ]
        </button>
      </div>

      {loading ? (
        <div className="loading-box">[ LOADING THREADS... ]</div>
      ) : comments.length === 0 ? (
        <div className="empty-box">[ NO COMMENTS IN RECORD. BE THE FIRST. ]</div>
      ) : (
        <div className="comments-tree">{comments.map((c) => renderCommentItem(c))}</div>
      )}
    </div>
  );
}
