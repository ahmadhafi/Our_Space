import { useState, useEffect } from 'react';
import { apiGet } from '../hooks/useApi';
import { getMediaUrl } from '../utils/media';
import useSWR from 'swr';

export default function StoryTray({ onStoryClick, onCreateClick }) {
  const { data, error } = useSWR('/api/stories', apiGet);
  const usersWithStories = data?.users || [];
  const loading = !data && !error;

  if (loading) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide">
      {/* Create Story Button */}
      <div 
        className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0"
        onClick={onCreateClick}
      >
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center bg-[#1A1A1A] relative">
          <span className="text-2xl text-gray-400">+</span>
        </div>
        <span className="text-xs text-gray-400 font-medium mt-1">Your Story</span>
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
  );
}
