import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../hooks/useApi';
import { getMediaUrl } from '../utils/media';

export default function CommentSection({ postId, comments: initialComments, onCommentAdded, onCommentDeleted }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(initialComments || []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const handleDeleteComment = async (commentId) => {
    try {
      const { apiDelete } = await import('../hooks/useApi');
      await apiDelete(`/api/posts/${postId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (onCommentDeleted) onCommentDeleted();
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (!initialComments || initialComments.length === 0) {
      setCommentsLoading(true);
      apiGet(`/api/posts/${postId}/comments`)
        .then(data => {
          setComments(data.comments || []);
        })
        .catch(err => console.error('Failed to fetch comments:', err))
        .finally(() => setCommentsLoading(false));
    }
  }, [postId, initialComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    try {
      const { apiPost } = await import('../hooks/useApi');
      const data = await apiPost(`/api/posts/${postId}/comments`, { text: text.trim() });
      setComments(prev => [...prev, data.comment]);
      setText('');
      if (onCommentAdded) onCommentAdded();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10 animate-fade-in">
      {/* Comment list */}
      <div className="space-y-4 mb-3 max-h-64 overflow-y-auto custom-scroll pr-2 mt-2">
        {commentsLoading ? (
          <div className="flex justify-center py-4">
            <div className="spinner !w-5 !h-5 !border-t-[#FFFC00]" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No comments yet. Be the first!</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex gap-2.5 group relative">
              {comment.avatar ? (
                <img src={getMediaUrl(comment.avatar)} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[#FFFC00]" />
              ) : (
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-black text-xs font-bold bg-[#FFFC00]">
                  {comment.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0 bg-[#2A2A2A] px-3 py-2 rounded-2xl rounded-tl-none">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-white">{comment.display_name || comment.username}</span>
                    <span className="text-xs text-gray-500">{formatTime(comment.created_at)}</span>
                  </div>
                  
                  {/* 3-Dot Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === comment.id ? null : comment.id)} 
                      className="text-gray-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                      </svg>
                    </button>
                    {activeMenuId === comment.id && (
                      <div className="absolute right-0 mt-1 w-36 bg-[#111] border border-[#333] rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
                        {user?.id === comment.user_id || user?.is_admin ? (
                          <button 
                            onClick={() => { handleDeleteComment(comment.id); setActiveMenuId(null); }}
                            className="w-full text-left px-3 py-2 text-xs text-red-500 font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            Delete
                          </button>
                        ) : (
                          <button 
                            onClick={() => { alert('Comment reported!'); setActiveMenuId(null); }}
                            className="w-full text-left px-3 py-2 text-xs text-white font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>
                            Report
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[14px] mt-0.5 break-words text-white pr-4">{comment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          className="input-field text-sm py-3 flex-1 bg-[#1A1A1A] border-white/10 text-white"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="btn-primary text-sm px-5 py-3 disabled:opacity-50 flex-shrink-0"
        >
          {loading ? '...' : 'Post'}
        </button>
      </form>
    </div>
  );
}
