import { useState } from 'react';
import { apiGet } from '../hooks/useApi';
import { getMediaUrl } from '../utils/media';
import useSWR from 'swr';

export default function StoryTray({ onStoryClick, onCreateClick }) {
  const { data, error } = useSWR('/api/stories', apiGet);
  const [showOptions, setShowOptions] = useState(false);
  const usersWithStories = data?.users || [];
  const loading = !data && !error;

  if (loading) return null;

  const handleSelectMode = (mode) => {
    setShowOptions(false);
    onCreateClick?.(mode);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide">
        {/* Create Story Button */}
        <div 
          className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group"
          onClick={() => setShowOptions(true)}
        >
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-yellow-400/70 hover:border-[#FFFC00] flex items-center justify-center bg-[#18191f] relative transition-all group-active:scale-95 shadow-md">
            <span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#FFFC00] text-black rounded-full flex items-center justify-center text-xs font-black shadow-md border-2 border-[#0A0A0A]">
              +
            </div>
          </div>
          <span className="text-xs text-gray-300 font-medium mt-1">Your Story</span>
        </div>

        {/* Users with Active Stories */}
        {usersWithStories.map(user => (
          <div 
            key={user.user_id} 
            className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
            onClick={() => onStoryClick(user)}
          >
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500">
              <div className="w-full h-full rounded-full border-2 border-[#0A0A0A] overflow-hidden bg-[#1A1A1A] flex items-center justify-center">
                {user.avatar ? (
                  <img src={getMediaUrl(user.avatar)} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>
            <span className="text-xs text-white font-medium mt-1 w-16 truncate text-center">
              {user.display_name || user.username}
            </span>
          </div>
        ))}
      </div>

      {/* Story Mode Selection Sheet */}
      {showOptions && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowOptions(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#18191f] border border-white/10 rounded-3xl p-5 space-y-3 shadow-2xl text-white animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <h3 className="font-bold text-base">New Story</h3>
              <button 
                onClick={() => setShowOptions(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSelectMode('camera')}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FFFC00] hover:bg-yellow-300 text-black font-bold text-sm flex items-center justify-between transition-colors shadow-md active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📸</span>
                  <span>Open Camera</span>
                </div>
                <span className="text-xs bg-black/10 px-2 py-0.5 rounded-full font-medium">Photo / Video</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('gallery')}
                className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm flex items-center gap-3 transition-colors border border-white/5"
              >
                <span className="text-xl">🖼</span>
                <span>Choose from Library</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('text')}
                className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm flex items-center gap-3 transition-colors border border-white/5"
              >
                <span className="text-xl">✍</span>
                <span>Write Text Status</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
