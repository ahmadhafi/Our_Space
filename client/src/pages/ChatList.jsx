import { useState, useEffect } from 'react';
import { apiGet } from '../hooks/useApi';
import { getMediaUrl } from '../utils/media';
import { useNavigate } from 'react-router-dom';

export default function ChatList() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const data = await apiGet('/api/chat');
      setChats(data.chats || []);
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="animate-fade-in px-4 pb-20">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
        Chats <span className="text-lg">💬</span>
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner !w-8 !h-8 !border-t-[#FFFC00]" />
        </div>
      ) : chats.length === 0 ? (
        <div className="bg-[#1A1A1A] rounded-[2rem] p-12 text-center border border-white/5">
          <div className="text-4xl mb-3">💬</div>
          <h3 className="font-semibold text-lg mb-1 text-white">No chats yet</h3>
        </div>
      ) : (
        <div className="bg-[#1A1A1A] rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/10">
          {chats.map(chat => {
            const latest = chat.latest_message;
            return (
              <div 
                key={chat.id} 
                className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                  {chat.avatar ? (
                    <img src={getMediaUrl(chat.avatar)} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold">
                      {chat.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-white truncate">{chat.display_name || chat.username}</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {latest ? formatTime(latest.created_at) : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className={`text-sm truncate ${chat.unread_count > 0 ? 'text-white font-medium' : 'text-gray-400'}`}>
                      {latest ? (
                        latest.text ? latest.text : (
                          <span className="italic flex items-center gap-1">
                            {latest.media_type === 'image' && '📷 Photo'}
                            {latest.media_type === 'video' && '🎥 Video'}
                            {latest.media_type === 'audio' && '🎤 Voice Message'}
                          </span>
                        )
                      ) : (
                        'Tap to start chatting'
                      )}
                    </p>
                    {chat.unread_count > 0 && (
                      <div className="w-5 h-5 bg-[#FFFC00] rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                        <span className="text-black text-[10px] font-bold">{chat.unread_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
