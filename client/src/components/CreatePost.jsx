import { useState, useRef } from 'react';
import { apiPost } from '../hooks/useApi';
import { compressFiles } from '../hooks/useImageCompress';
import VoiceRecorder from './VoiceRecorder';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

export default function CreatePost({ onPostCreated }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files);
    setError('');

    // Validate file sizes and types
    for (const file of selected) {
      if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
        setError(`Image "${file.name}" exceeds 10MB limit`);
        return;
      }
      if (file.type.startsWith('video/')) {
        if (file.size > MAX_VIDEO_SIZE) {
          setError(`Video "${file.name}" exceeds 50MB limit`);
          return;
        }
        if (file.size > 50 * 1024 * 1024) {
          setError(`Video "${file.name}" is very large. Consider compressing it first.`);
        }
      }
      if (file.type.startsWith('audio/') && file.size > MAX_AUDIO_SIZE) {
        setError(`Audio "${file.name}" exceeds 20MB limit`);
        return;
      }
    }

    // Compress images
    const compressed = await compressFiles(selected);

    // Generate previews
    const newPreviews = compressed.map(file => ({
      file,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'audio',
      url: URL.createObjectURL(file),
      name: file.name
    }));

    setFiles(prev => [...prev, ...compressed]);
    setPreviews(prev => [...prev, ...newPreviews]);

    // Reset input
    e.target.value = '';
  };

  const handleVoiceRecording = (voiceFile) => {
    setFiles(prev => [...prev, voiceFile]);
    setPreviews(prev => [...prev, {
      file: voiceFile,
      type: 'audio',
      url: URL.createObjectURL(voiceFile),
      name: voiceFile.name
    }]);
    setShowVoiceRecorder(false);
  };

  const removeFile = (index) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || loading) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (text.trim()) formData.append('text', text.trim());
      files.forEach(file => formData.append('media', file));

      const data = await apiPost('/api/posts', formData);

      // Reset form
      setText('');
      previews.forEach(p => URL.revokeObjectURL(p.url));
      setFiles([]);
      setPreviews([]);

      if (onPostCreated) onPostCreated(data.post);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1A1A1A] rounded-[2rem] p-5 border border-white/5 relative z-10 mb-4">
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind? 💭"
          className="input-field resize-none min-h-[80px]"
          rows={3}
        />

        {/* File previews */}
        {previews.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                {preview.type === 'image' && (
                  <img src={preview.url} alt="" className="w-20 h-20 object-cover rounded-xl" />
                )}
                {preview.type === 'video' && (
                  <div className="w-20 h-20 rounded-xl bg-gray-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
                {preview.type === 'audio' && (
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                    <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Voice recorder */}
        {showVoiceRecorder && (
          <div className="mt-3">
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecording}
              onCancel={() => setShowVoiceRecorder(false)}
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="mt-2 text-sm text-red-500 animate-fade-in">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/mp3,audio/wav"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full hover:bg-white/10 transition-colors text-white bg-[#2A2A2A]"
              title="Add media"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
              className="p-3 rounded-full hover:bg-white/10 transition-colors text-white bg-[#2A2A2A]"
              title="Record voice note"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>

          <button
            type="submit"
            disabled={(!text.trim() && files.length === 0) || loading}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="spinner !w-4 !h-4 !border-t-black" />
                Posting...
              </span>
            ) : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
