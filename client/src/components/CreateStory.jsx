import { useState, useRef } from 'react';
import { apiPost } from '../hooks/useApi';

const COLORS = [
  '#FF3366', '#9933FF', '#33CCFF', '#00C853', '#FF9900', '#1A1A1A'
];

export default function CreateStory({ onClose, onCreated }) {
  const [type, setType] = useState('media'); // 'media' | 'text'
  const [media, setMedia] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMedia(file);
      setPreview(URL.createObjectURL(file));
      setType('media');
    }
  };

  const handleSubmit = async () => {
    if (type === 'media' && !media) return;
    if (type === 'text' && !text.trim()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      if (type === 'media') {
        formData.append('media_type', media.type.startsWith('video') ? 'video' : 'image');
        formData.append('media', media);
      } else {
        formData.append('media_type', 'text');
        formData.append('text_content', text);
        formData.append('bg_color', bgColor);
      }

      await apiPost('/api/stories', formData, true); // true for multipart
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to post story', err);
      alert('Failed to post story: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center p-4 z-20">
        <button onClick={onClose} className="text-white p-2">✕ Cancel</button>
        <button 
          onClick={handleSubmit} 
          disabled={loading || (type === 'media' && !media) || (type === 'text' && !text.trim())}
          className="bg-white text-black px-4 py-1.5 rounded-full font-bold disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Share'}
        </button>
      </div>

      {/* Content */}
      <div 
        className="flex-1 relative flex items-center justify-center m-4 rounded-2xl overflow-hidden"
        style={{ backgroundColor: type === 'text' ? bgColor : '#1A1A1A' }}
      >
        {type === 'media' ? (
          preview ? (
            media.type.startsWith('video') ? (
              <video src={preview} controls className="w-full h-full object-cover sm:object-contain" />
            ) : (
              <img src={preview} className="w-full h-full object-cover sm:object-contain" alt="Preview" />
            )
          ) : (
            <div className="text-center">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-4 mb-2 transition-colors"
              >
                📷 Select Photo/Video
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,video/*" 
                onChange={handleFileChange} 
              />
              <p className="text-gray-400 mt-4 cursor-pointer" onClick={() => setType('text')}>
                Or write a text status
              </p>
            </div>
          )
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a status..."
            className="bg-transparent text-white text-3xl font-bold text-center w-full h-full p-8 resize-none focus:outline-none placeholder-white/50"
            autoFocus
          />
        )}
      </div>

      {/* Footer controls */}
      {type === 'text' && (
        <div className="p-4 flex justify-center gap-3 overflow-x-auto pb-8">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setBgColor(c)}
              className={`w-10 h-10 rounded-full border-2 ${bgColor === c ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
