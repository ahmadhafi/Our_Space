import { useState, useEffect, useRef } from 'react';
import { getMediaUrl } from '../utils/media';
import { useAuth } from '../hooks/useAuth';
import { apiPost, apiDelete } from '../hooks/useApi';

export default function StoryViewer({ user, onClose, onStoryDeleted }) {
  const { user: currentUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const videoRef = useRef(null);

  const stories = user?.stories || [];
  const currentStory = stories[currentIndex];
  const isOwnStory = currentUser && user?.user_id === currentUser.id;

  useEffect(() => {
    if (!currentStory) return;

    let animationFrame;
    let lastTime = Date.now();
    let currentElapsed = (progress / 100) * 5000;
    const duration = 5000; // 5 seconds for images/text

    const updateProgress = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      
      if (!paused) {
        currentElapsed += delta;
        const newProgress = (currentElapsed / duration) * 100;
        if (newProgress < 100) {
          setProgress(newProgress);
        } else {
          handleNext();
          return; // Stop animation loop
        }
      }
      animationFrame = requestAnimationFrame(updateProgress);
    };

    if (currentStory.media_type === 'video') {
      // Progress handled by video timeupdate
      if (videoRef.current && !paused) {
        videoRef.current.play().catch(e => console.error("Autoplay prevented", e));
      } else if (videoRef.current && paused) {
        videoRef.current.pause();
      }
    } else {
      animationFrame = requestAnimationFrame(updateProgress);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [currentIndex, currentStory, paused]); // paused is in dependency array to update lastTime properly

  // Reset progress when index changes
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleVideoProgress = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const sendReply = async (textOverride = null) => {
    const textToSend = textOverride || replyText;
    if (!textToSend.trim() || sending) return;

    setSending(true);
    try {
      const payload = { 
        text: textToSend,
        reply_to_story_url: currentStory.media_type !== 'text' ? currentStory.file_path : null,
        reply_to_story_type: currentStory.media_type
      };
      
      await apiPost(`/api/chat/${user.user_id}`, payload);
      if (!textOverride) setReplyText('');
      // Flash a success or just close/resume
      setPaused(false);
    } catch (err) {
      console.error('Failed to reply', err);
      alert('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this story?')) return;
    
    setPaused(true);
    try {
      await apiDelete(`/api/stories/${currentStory.id}`);
      if (onStoryDeleted) {
        onStoryDeleted(currentStory.id);
      }
      handleNext();
    } catch (err) {
      console.error('Failed to delete story', err);
      alert('Failed to delete story');
      setPaused(false);
    }
  };

  const handlePointerDown = (e) => {
    // Ignore if clicking on input or button
    if (e.target.closest('input') || e.target.closest('button')) return;
    setPaused(true);
  };

  const handlePointerUp = (e) => {
    if (e.target.closest('input') || e.target.closest('button')) return;
    // Resume only if we are not currently typing
    if (document.activeElement.tagName !== 'INPUT') {
      setPaused(false);
    }
  };

  if (!currentStory) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in touch-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Progress Bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 sm:p-4 pt-4 sm:pt-6 pointer-events-none">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all ease-linear"
              style={{ 
                width: i === currentIndex ? `${progress}%` : (i < currentIndex ? '100%' : '0%'),
                transitionDuration: paused ? '0ms' : '100ms'
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800">
            {user.avatar ? (
              <img src={getMediaUrl(user.avatar)} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col drop-shadow-md">
            <span className="text-white font-semibold text-sm">{user.display_name || user.username}</span>
            <span className="text-white/80 text-xs">
              {new Date(currentStory.created_at).toLocaleString(undefined, { 
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={(e) => { e.stopPropagation(); setPaused(!paused); }} 
            className="text-white p-2 text-xl drop-shadow-md hover:text-gray-300 transition-colors"
          >
            {paused ? '▶' : '⏸'}
          </button>
          {isOwnStory && (
            <button onClick={handleDelete} className="text-white p-2 text-xl drop-shadow-md hover:text-red-500 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="text-white p-2 text-2xl drop-shadow-md">✕</button>
        </div>
      </div>

      {/* Tap Zones for Navigation */}
      <div className="absolute inset-0 z-10 flex">
        <div className="w-1/3 h-full cursor-pointer" onClick={(e) => {
          if (!paused || (paused && document.activeElement.tagName !== 'INPUT')) {
            handlePrev();
          }
        }} />
        <div className="w-2/3 h-full cursor-pointer" onClick={(e) => {
          if (!paused || (paused && document.activeElement.tagName !== 'INPUT')) {
            handleNext();
          }
        }} />
      </div>

      {/* Content */}
      <div className="flex-1 w-full h-full bg-gray-900 relative rounded-none overflow-hidden flex items-center justify-center">
        {currentStory.media_type === 'image' && (
          <img 
            src={getMediaUrl(currentStory.file_path)} 
            className="w-full h-full object-contain pointer-events-none" 
            alt="Story" 
          />
        )}
        
        {currentStory.media_type === 'video' && (
          <video
            ref={videoRef}
            src={getMediaUrl(currentStory.file_path)}
            className="w-full h-full object-contain pointer-events-none"
            playsInline
            onTimeUpdate={handleVideoProgress}
            onEnded={handleNext}
          />
        )}

        {currentStory.media_type === 'text' && (
          <div 
            className="w-full h-full flex items-center justify-center p-8 text-center pointer-events-none"
            style={{ backgroundColor: currentStory.bg_color || '#FF3366' }}
          >
            <p className="text-white text-3xl font-bold font-sans drop-shadow-md whitespace-pre-wrap">
              {currentStory.text_content}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Reply Bar */}
      {!isOwnStory && (
        <div className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-safe bg-gradient-to-t from-black/80 to-transparent">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              sendReply();
            }} 
            className="flex items-center gap-3 max-w-lg mx-auto"
          >
            <input
              type="text"
              placeholder={`Reply to ${user.display_name || user.username}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              className="flex-1 bg-black/40 border border-white/30 text-white rounded-full px-4 py-3 placeholder-white/70 focus:outline-none focus:bg-black/60 focus:border-white transition-colors"
            />
            {replyText.trim() ? (
              <button 
                type="submit" 
                disabled={sending}
                className="text-white font-bold px-3 py-2 disabled:opacity-50"
              >
                Send
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => sendReply('❤️ Reacted to your story')}
                disabled={sending}
                className="text-2xl hover:scale-110 transition-transform disabled:opacity-50"
              >
                ❤️
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
