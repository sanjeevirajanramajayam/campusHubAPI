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
    const canReply = item.depth < 3;

    return (
      <div key={item.id} className={`comment-node depth-${item.depth}`}>
        <div className="comment-meta">
          <span className="comment-author">u/{item.authorName}</span>
          <span className="comment-depth-tag">L{item.depth}</span>
          <span className="pipe">|</span>
          <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
          {item.isDeleted && <span className="badge red mini">[TOMBSTONE]</span>}
        </div>

        <div className={`comment-text ${item.isDeleted ? 'tombstone' : ''}`}>
          {item.content}
        </div>

        <div className="comment-actions">
          {!item.isDeleted && (
            <button className="action-link" onClick={() => handleVoteComment(item.id)}>
              [ ▲ {item.likeCount} ]
            </button>
          )}

          {canReply && !item.isDeleted && (
            <>
              <span className="pipe">|</span>
              <button
                className="action-link"
                onClick={() => setReplyingToId(replyingToId === item.id ? null : item.id)}
              >
                [ REPLY ]
              </button>
            </>
          )}

          {isAuthor && !item.isDeleted && (
            <>
              <span className="pipe">|</span>
              <button className="action-link delete" onClick={() => handleDeleteComment(item.id)}>
                [ DELETE ]
              </button>
            </>
          )}
        </div>

        {/* Reply form */}
        {replyingToId === item.id && (
          <div className="reply-form">
            <textarea
              className="brutal-textarea"
              rows={2}
              placeholder="ENTER REPLY..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="brutal-btn mini" onClick={() => handleCreateComment(item.id, replyText)}>
                [ TRANSMIT REPLY ]
              </button>
              <button className="brutal-btn mini red-btn" onClick={() => setReplyingToId(null)}>
                [ CANCEL ]
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {item.replies && item.replies.length > 0 && (
          <div className="nested-replies">
            {item.replies.map((reply) => renderCommentItem(reply))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="comment-drawer">
      {/* Input box */}
      <div className="comment-input-box">
        <textarea
          rows={2}
          placeholder="DISPATCH TELEMETRY COMMENT..."
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
        />
        <div style={{ marginTop: '6px' }}>
          <button className="brutal-btn mini" onClick={() => handleCreateComment(null, newCommentText)}>
            [ TRANSMIT COMMENT ]
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">[ LOADING THREAD TELEMETRY... ]</div>
      ) : comments.length === 0 ? (
        <div className="empty-box">[ NO COMMENTS IN RECORD ]</div>
      ) : (
        <div className="comment-tree">{comments.map((c) => renderCommentItem(c))}</div>
      )}
    </div>
  );
}
