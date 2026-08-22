import { useState, useEffect, useRef } from 'react';
import { getMediaUrl } from '../utils/media';

export default function StoryViewer({ user, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  const stories = user?.stories || [];
  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!currentStory) return;

    let timer;
    let animationFrame;
    const duration = 5000; // 5 seconds for images/text
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / duration) * 100;
      
      if (newProgress < 100) {
        setProgress(newProgress);
        animationFrame = requestAnimationFrame(updateProgress);
      } else {
        handleNext();
      }
    };

    if (currentStory.media_type === 'video') {
      // For video, progress is handled by the video element's timeupdate event
      if (videoRef.current) {
        videoRef.current.play().catch(e => console.error("Autoplay prevented", e));
      }
    } else {
      animationFrame = requestAnimationFrame(updateProgress);
    }

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationFrame);
    };
  }, [currentIndex, currentStory]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleVideoProgress = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col sm:p-4 animate-fade-in touch-none">
      {/* Progress Bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 sm:p-4 pt-4 sm:pt-6">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ 
                width: i === currentIndex ? `${progress}%` : (i < currentIndex ? '100%' : '0%') 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between p-4">
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
          <span className="text-white font-semibold text-sm shadow-sm">{user.display_name || user.username}</span>
        </div>
        <button onClick={onClose} className="text-white p-2 text-2xl drop-shadow-md">✕</button>
      </div>

      {/* Tap Zones for Navigation */}
      <div className="absolute inset-0 z-10 flex">
        <div className="w-1/3 h-full cursor-pointer" onClick={handlePrev} />
        <div className="w-2/3 h-full cursor-pointer" onClick={handleNext} />
      </div>

      {/* Content */}
      <div className="flex-1 w-full h-full max-w-lg mx-auto bg-gray-900 relative rounded-none sm:rounded-2xl overflow-hidden flex items-center justify-center">
        {currentStory.media_type === 'image' && (
          <img 
            src={getMediaUrl(currentStory.file_path)} 
            className="w-full h-full object-cover sm:object-contain" 
            alt="Story" 
          />
        )}
        
        {currentStory.media_type === 'video' && (
          <video
            ref={videoRef}
            src={getMediaUrl(currentStory.file_path)}
            className="w-full h-full object-cover sm:object-contain"
            playsInline
            onTimeUpdate={handleVideoProgress}
            onEnded={handleNext}
          />
        )}

        {currentStory.media_type === 'text' && (
          <div 
            className="w-full h-full flex items-center justify-center p-8 text-center"
            style={{ backgroundColor: currentStory.bg_color || '#FF3366' }}
          >
            <p className="text-white text-2xl font-bold font-sans drop-shadow-md">
              {currentStory.text_content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
