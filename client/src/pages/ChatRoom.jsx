import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { getMediaUrl } from '../utils/media';
import { compressImage } from '../hooks/useImageCompress';
import VoiceRecorder from '../components/VoiceRecorder';
import useSWR from 'swr';

export default function ChatRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [otherUser, setOtherUser] = useState(null);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch chat info
  useEffect(() => {
    apiGet('/api/chat').then(data => {
      const u = data.chats.find(c => c.id === parseInt(id));
      if (u) setOtherUser(u);
    }).catch(console.error);
  }, [id]);

  // Fetch messages with SWR polling
  const { data, mutate } = useSWR(`/api/chat/${id}`, apiGet, { 
    refreshInterval: 3000,
    onSuccess: (data) => {
      // Scroll to bottom on initial load if we don't have messages yet
      if (messages.length === 0) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  });

  const messages = data?.messages || [];

  // Mark as read when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const hasUnreadFromOther = messages.some(m => m.sender_id === parseInt(id) && !m.is_read);
      if (hasUnreadFromOther) {
        apiPut(`/api/chat/${id}/read`).catch(console.error);
      }
    }
  }, [messages, id]);

  const handleSendText = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      const res = await apiPost(`/api/chat/${id}`, { text: inputText });
      mutate(prev => ({ ...prev, messages: [...(prev?.messages || []), res.message] }), false);
      setInputText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to send text', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (e) => {
    const file = e.target.files[0];
    if (!file || sending) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('media_type', file.type.startsWith('video') ? 'video' : 'image');
      const compressedFile = await compressImage(file);
      formData.append('media', compressedFile);
      
      const res = await apiPost(`/api/chat/${id}`, formData, true);
      mutate(prev => ({ ...prev, messages: [...(prev?.messages || []), res.message] }), false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to send media', err);
      alert('Failed to send media');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendAudio = async (audioFile) => {
    setSending(true);
    setIsRecording(false);
    try {
      const formData = new FormData();
      formData.append('media_type', 'audio');
      formData.append('media', audioFile);

      const res = await apiPost(`/api/chat/${id}`, formData, true);
      mutate(prev => ({ ...prev, messages: [...(prev?.messages || []), res.message] }), false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to send audio', err);
      alert('Failed to send voice message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0A0A0A] fixed inset-0 z-50 animate-slide-up">
      {/* Header */}
      <div className="bg-[#1A1A1A] border-b border-white/5 p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-white p-2 -ml-2 rounded-full hover:bg-white/10">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        
        {otherUser && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
              {otherUser.avatar ? (
                <img src={getMediaUrl(otherUser.avatar)} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  {otherUser.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-white font-bold">{otherUser.display_name || otherUser.username}</h2>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  isMe ? 'bg-[#FFFC00] text-black rounded-tr-sm' : 'bg-[#1A1A1A] text-white rounded-tl-sm border border-white/5'
                }`}
              >
                {/* Story Reply Context */}
                {msg.reply_to_story_url && (
                  <div className="mb-2 flex flex-col w-48 rounded-xl overflow-hidden bg-black/20 border border-white/10">
                    <div className="p-2 text-[10px] font-bold opacity-70 uppercase tracking-wider text-center bg-black/40 text-white">
                      {isMe ? 'Replied to their story' : 'Replied to your story'}
                    </div>
                    <div className="w-full aspect-[9/16] bg-black">
                      {msg.reply_to_story_type === 'video' ? (
                        <video src={getMediaUrl(msg.reply_to_story_url)} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                      ) : (
                        <img src={getMediaUrl(msg.reply_to_story_url)} className="w-full h-full object-cover" alt="Story" />
                      )}
                    </div>
                  </div>
                )}

                {/* Media */}
                {msg.media_type === 'image' && !msg.reply_to_story_url && (
                  <img src={getMediaUrl(msg.file_path)} alt="Attached" className="rounded-xl mb-2 max-w-full" />
                )}
                {msg.media_type === 'video' && !msg.reply_to_story_url && (
                  <video src={getMediaUrl(msg.file_path)} controls className="rounded-xl mb-2 max-w-full max-h-[300px]" />
                )}
                {msg.media_type === 'audio' && (
                  <audio src={getMediaUrl(msg.file_path)} controls className="mb-2 max-w-[200px]" />
                )}

                {/* Text */}
                {msg.text && (
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                )}

                {/* Time & Read Receipt */}
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-black/60' : 'text-gray-500'}`}>
                  <span>{formatTime(msg.created_at)}</span>
                  {isMe && (
                    <span className={msg.is_read ? 'text-blue-600' : 'text-black/40'}>
                      {msg.is_read ? '✔✔' : '✔'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#1A1A1A] border-t border-white/5 p-2 sm:p-4 pb-safe">
        {isRecording ? (
          <div className="flex items-center gap-2 w-full">
            <button 
              onClick={() => setIsRecording(false)}
              className="p-3 text-red-500 hover:bg-white/5 rounded-full"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex-1">
              <VoiceRecorder onRecordingComplete={handleSendAudio} />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-white rounded-full hover:bg-white/5 flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              onChange={handleSendMedia} 
            />

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-[#0A0A0A] text-white border border-white/10 rounded-full px-4 py-3 focus:outline-none focus:border-[#FFFC00]"
            />

            {inputText.trim() ? (
              <button 
                type="submit"
                disabled={sending}
                className="p-3 bg-[#FFFC00] text-black rounded-full hover:bg-[#E6E300] flex-shrink-0 disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecording(true)}
                className="p-3 text-[#FFFC00] hover:bg-[#FFFC00]/10 rounded-full flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
