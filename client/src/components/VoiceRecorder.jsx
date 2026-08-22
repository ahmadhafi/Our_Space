import { useState, useRef, useEffect } from 'react';

export default function VoiceRecorder({ onRecordingComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTimer();
      stopVisualization();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startTimer = () => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startVisualization = (stream) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !analyserRef.current) return;

      const ctx = canvas.getContext('2d');
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
      ctx.lineWidth = 2;
      ctx.strokeStyle = accentColor || '#f9a8d4';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const types = ['audio/webm', 'audio/mp4', 'audio/ogg'];
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) {
            mimeType = t;
            break;
          }
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        stopVisualization();
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
      startVisualization(stream);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const handleConfirm = () => {
    if (audioBlob) {
      const type = audioBlob.type || 'audio/webm';
      let ext = 'webm';
      if (type.includes('mp4')) ext = 'm4a';
      else if (type.includes('ogg')) ext = 'ogg';
      else if (type.includes('wav')) ext = 'wav';
      
      const file = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type });
      onRecordingComplete(file);
    }
  };

  const handleDiscard = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    onCancel();
  };

  return (
    <div className="glass-card p-4 animate-scale-in">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse-soft' : 'bg-gray-300'}`} />
        <span className="text-sm font-medium">
          {isRecording ? 'Recording...' : audioBlob ? 'Recording complete' : 'Voice Note'}
        </span>
        <span className="text-sm text-gray-500 ml-auto font-mono">{formatTime(duration)}</span>
      </div>

      {/* Waveform canvas */}
      {isRecording && (
        <canvas ref={canvasRef} width={300} height={60} className="w-full h-15 mb-3 rounded-lg bg-black/5" />
      )}

      {/* Playback */}
      {audioUrl && !isRecording && (
        <audio src={audioUrl} controls className="w-full mb-3 h-10" />
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {!isRecording && !audioBlob && (
          <button onClick={startRecording} className="btn-primary flex items-center gap-2 text-sm">
            <MicIcon className="w-4 h-4" />
            Start Recording
          </button>
        )}

        {isRecording && (
          <button onClick={stopRecording} className="btn-danger flex items-center gap-2 text-sm">
            <StopIcon className="w-4 h-4" />
            Stop
          </button>
        )}

        {audioBlob && !isRecording && (
          <>
            <button onClick={handleConfirm} className="btn-primary text-sm">
              Use Recording
            </button>
            <button onClick={handleDiscard} className="btn-secondary text-sm">
              Discard
            </button>
          </>
        )}

        {!audioBlob && !isRecording && (
          <button onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function MicIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
