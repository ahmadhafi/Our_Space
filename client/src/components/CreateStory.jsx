import { useState, useRef, useEffect } from 'react';
import { apiPost } from '../hooks/useApi';
import { compressImage } from '../hooks/useImageCompress';

const COLORS = [
  '#FF3366', '#9933FF', '#33CCFF', '#00C853', '#FF9900', '#1A1A1A'
];

export default function CreateStory({ onClose, onCreated, initialMode = 'camera' }) {
  const [type, setType] = useState(initialMode === 'text' ? 'text' : 'media');
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Automatically trigger camera or gallery if requested on initial mount
  useEffect(() => {
    if (initialMode === 'camera' && !media && !preview) {
      const timer = setTimeout(() => {
        cameraInputRef.current?.click();
      }, 120);
      return () => clearTimeout(timer);
    } else if (initialMode === 'gallery' && !media && !preview) {
      const timer = setTimeout(() => {
        galleryInputRef.current?.click();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [initialMode]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMedia(file);
      setPreview(URL.createObjectURL(file));
      setType('media');
    }
    // Reset inputs so the same file or retake can be triggered again
    if (e.target) e.target.value = '';
  };

  const handleRetake = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setMedia(null);
    setPreview(null);
    cameraInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (type === 'media' && !media) return;
    if (type === 'text' && !text.trim()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      if (type === 'media') {
        const compressedMedia = await compressImage(media);
        formData.append('media_type', media.type.startsWith('video') ? 'video' : 'image');
        formData.append('media', compressedMedia);
        if (text.trim()) {
          formData.append('text_content', text.trim());
        }
      } else {
        formData.append('media_type', 'text');
        formData.append('text_content', text.trim());
        formData.append('bg_color', bgColor);
      }

      await apiPost('/api/stories', formData, true); // multipart
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to post story', err);
      alert('Failed to post story: ' + (err.message || 'Error occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-slide-up">
      {/* Hidden File Inputs: Camera (capture="environment") & Gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={galleryInputRef}
        className="hidden"
        accept="image/*,video/*"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex justify-between items-center p-4 z-20 bg-gradient-to-b from-black/80 to-transparent">
        <button 
          onClick={onClose} 
          className="text-white px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md transition-colors"
        >
          ✕ Cancel
        </button>

        <div className="flex items-center gap-2">
          {preview && type === 'media' && (
            <button
              onClick={handleRetake}
              className="text-white px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md transition-colors flex items-center gap-1"
            >
              <span>📸 Retake</span>
            </button>
          )}

          <button 
            onClick={handleSubmit} 
            disabled={loading || (type === 'media' && !media) || (type === 'text' && !text.trim())}
            className="bg-[#FFFC00] text-black px-5 py-1.5 rounded-full font-bold text-xs hover:bg-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            {loading ? 'Posting...' : 'Share Story'}
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div 
        className="flex-1 relative flex items-center justify-center m-2 sm:m-4 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        style={{ backgroundColor: type === 'text' ? bgColor : '#121316' }}
      >
        {type === 'media' ? (
          preview ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {media.type.startsWith('video') ? (
                <video 
                  src={preview} 
                  controls 
                  playsInline 
                  className="w-full h-full object-cover sm:object-contain" 
                />
              ) : (
                <img 
                  src={preview} 
                  className="w-full h-full object-cover sm:object-contain" 
                  alt="Story Preview" 
                />
              )}

              {/* Caption Overlay Bar */}
              <div className="absolute bottom-4 left-4 right-4 z-20">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add a caption... (optional)"
                  className="w-full bg-black/60 backdrop-blur-md text-white border border-white/20 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-[#FFFC00] shadow-lg"
                />
              </div>
            </div>
          ) : (
            <div className="text-center p-6 max-w-sm w-full space-y-4 animate-fade-in">
              <div className="w-20 h-20 mx-auto rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 flex items-center justify-center text-4xl shadow-inner mb-2">
                📸
              </div>
              <h3 className="text-white text-xl font-bold">Create a Story</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                Directly capture a photo/video with your camera or select media from your library.
              </p>

              <div className="space-y-3 pt-2">
                {/* Direct Camera Button */}
                <button 
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#FFFC00] hover:bg-[#e6e300] text-black font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2.5 active:scale-95"
                >
                  <span className="text-lg">📸</span>
                  <span>Open Camera (Photo / Video)</span>
                </button>

                {/* Gallery Button */}
                <button 
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all border border-white/10 flex items-center justify-center gap-2.5"
                >
                  <span className="text-lg">🖼</span>
                  <span>Choose from Gallery</span>
                </button>

                {/* Text Story Switcher */}
                <button
                  type="button"
                  onClick={() => setType('text')}
                  className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Or write a text status →
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative p-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a status..."
              className="bg-transparent text-white text-3xl font-bold text-center w-full max-w-md resize-none focus:outline-none placeholder-white/50"
              rows={4}
              autoFocus
            />

            <button
              type="button"
              onClick={() => setType('media')}
              className="absolute bottom-6 text-xs text-white/70 hover:text-white bg-black/40 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/20 transition-colors"
            >
              ← Back to Camera / Photo
            </button>
          </div>
        )}
      </div>

      {/* Footer controls for text stories */}
      {type === 'text' && (
        <div className="p-4 flex justify-center gap-3 overflow-x-auto pb-8">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setBgColor(c)}
              className={`w-10 h-10 rounded-full border-2 transition-transform ${bgColor === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
