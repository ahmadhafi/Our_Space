import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import CommentSection from './CommentSection';

export default function PostCard({ post, onDelete, onLikeToggle }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.user_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const canDelete = user?.id === post.user_id || user?.is_admin;

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);

    // Optimistic update
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);

    try {
      const { apiPost } = await import('../hooks/useApi');
      const data = await apiPost(`/api/posts/${post.id}/like`, {});
      setLiked(data.liked);
      setLikeCount(data.like_count);
    } catch (err) {
      // Revert on error
      setLiked(liked);
      setLikeCount(likeCount);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { apiDelete } = await import('../hooks/useApi');
      await apiDelete(`/api/posts/${post.id}`);
      if (onDelete) onDelete(post.id);
    } catch (err) {
      alert(err.message);
    }
    setShowDeleteConfirm(false);
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const renderMedia = (media) => {
    const src = `/uploads/${media.file_path}`;
    switch (media.media_type) {
      case 'image':
        return (
          <img
            key={media.id}
            src={src}
            alt={media.original_name}
            className="rounded-xl max-h-96 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
            loading="lazy"
            onClick={() => window.open(src, '_blank')}
          />
        );
      case 'video':
        return (
          <video
            key={media.id}
            src={src}
            controls
            preload="metadata"
            className="rounded-xl max-h-96 w-full"
          />
        );
      case 'audio':
        return (
          <div key={media.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/5">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-accent)' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            </div>
            <audio src={src} controls className="flex-1 h-10" preload="metadata" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#1A1A1A] rounded-[2rem] overflow-hidden animate-fade-in mb-6 border border-white/5">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        {post.avatar ? (
          <img src={`/uploads/${post.avatar}`} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold" style={{ background: 'var(--color-accent)' }}>
            {post.username?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{post.display_name || post.username}</span>
            <span className="text-xs text-gray-500">@{post.username}</span>
          </div>
          <span className="text-xs text-gray-500">{formatTime(post.created_at)}</span>
        </div>

        {/* 3-Dot Menu */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-[#2A2A2A] rounded-2xl shadow-xl z-50 overflow-hidden border border-[#333] animate-scale-in">
              {canDelete ? (
                <>
                  {!showDeleteConfirm ? (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full text-left px-4 py-3 text-sm text-red-500 font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Delete Post
                    </button>
                  ) : (
                    <div className="p-2 flex gap-2">
                      <button onClick={handleDelete} className="flex-1 text-xs px-2 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors">
                        Confirm
                      </button>
                      <button onClick={() => { setShowDeleteConfirm(false); setShowMenu(false); }} className="flex-1 text-xs px-2 py-2 rounded-xl bg-[#3A3A3A] text-white font-bold hover:bg-[#4A4A4A] transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => { alert('Post reported!'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-white font-bold hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                  </svg>
                  Report Post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Text content */}
      {post.text && (
        <p className="text-[15px] leading-relaxed px-4 pb-3 text-white whitespace-pre-wrap break-words">{post.text}</p>
      )}

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <div className={`w-full ${post.media.length > 1 ? 'grid grid-cols-2 gap-1' : ''}`}>
          {post.media.map(m => (
            <div key={m.id} className="w-full">
              {m.media_type === 'image' && (
                <img
                  src={`/uploads/${m.file_path}`}
                  alt={m.original_name}
                  className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(`/uploads/${m.file_path}`, '_blank')}
                />
              )}
              {m.media_type === 'video' && (
                <video
                  src={`/uploads/${m.file_path}`}
                  controls
                  className="w-full max-h-[500px] object-cover bg-black"
                />
              )}
              {m.media_type === 'audio' && (
                <div className="flex items-center gap-3 p-4 bg-[#2A2A2A] mx-4 mb-3 rounded-xl">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#FFFC00]">
                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  </div>
                  <audio src={`/uploads/${m.file_path}`} controls className="flex-1 h-10" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 p-4 text-white">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 text-sm transition-all duration-200 ${liked ? 'scale-110 text-red-500' : 'hover:scale-110 text-white'}`}
        >
          <svg className="w-6 h-6" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <span className="font-bold">{likeCount}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm hover:scale-110 transition-all duration-200"
        >
          <svg className="w-6 h-6" fill={showComments ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          <span className="font-bold">{commentCount}</span>
        </button>
      </div>

      {/* Comments Container */}
      {showComments && (
        <div className="px-4 pb-4 animate-fade-in">
          <CommentSection
            postId={post.id}
            comments={[]}
            onCommentAdded={() => setCommentCount(c => c + 1)}
          />
        </div>
      )}
    </div>
  );
}
