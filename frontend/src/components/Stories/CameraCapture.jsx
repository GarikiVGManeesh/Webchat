import { useEffect, useRef, useState, useCallback } from 'react';
import { FiX, FiRefreshCw, FiImage, FiVideo, FiSquare } from 'react-icons/fi';

/**
 * CameraCapture — full live-camera interface for taking a story photo
 * or recording a story video.
 *
 * Props:
 *  - onCaptured(file, previewUrl, kind): called after capture ("image" | "video")
 *  - onCancel(): close the whole composer
 *  - onUseGallery(): jump to the gallery upload flow
 */
const CameraCapture = ({ onCaptured, onCancel, onUseGallery }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [facing, setFacing] = useState('user');
  const [status, setStatus] = useState('starting'); // starting | live | denied | error
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState('photo'); // photo | video
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const MAX_VIDEO_SECONDS = 60; // mirrors the 60MB story upload cap

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (camMode) => {
    // Not available (non-secure context / unsupported browser)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setErrorMsg('Camera is not supported on this browser or connection.');
      return;
    }

    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: camMode },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: true, // needed so video stories can carry sound
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Keep the preview silent — we only want audio on the recording.
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      setStatus('live');
    } catch (err) {
      console.error('Camera error:', err);
      // Some devices/browsers block audio; retry video-only before giving up.
      if (err.name !== 'NotAllowedError' && err.name !== 'NotFoundError') {
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: camMode } },
            audio: false,
          });
          streamRef.current = videoOnly;
          if (videoRef.current) {
            videoRef.current.srcObject = videoOnly;
            videoRef.current.muted = true;
            await videoRef.current.play();
          }
          setStatus('live');
          return;
        } catch {
          /* fall through to the error handling below */
        }
      }
      // Permission denied / dismissed
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg('Camera access is required to capture a story.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('error');
        setErrorMsg('No camera was found on this device.');
      } else if (err.name === 'NotReadableError') {
        setStatus('error');
        setErrorMsg('The camera is already in use by another application.');
      } else {
        setStatus('error');
        setErrorMsg('Unable to start the camera. Please try again.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera('user');
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      // If the component unmounts mid-recording, discard the recorder cleanly.
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* already stopped */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = async () => {
    if (recording) return; // don't switch mid-recording
    const next = facing === 'user' ? 'environment' : 'user';
    stopStream();
    await startCamera(next);
    // If the device only has one camera, startCamera keeps the old error-free
    // state; set the label optimistically.
    setFacing(next);
  };

  // ==================== PHOTO CAPTURE ====================
  const handleCapturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    // Flip selfie captures horizontally so the preview matches the mirror
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;

    const file = new File([blob], `story-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });

    stopStream();
    onCaptured(file, URL.createObjectURL(file) || dataUrl, 'image');
  };

  // ==================== VIDEO RECORDING ====================
  const pickVideoMime = () => {
    const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    if (typeof MediaRecorder === 'undefined') return '';
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  };

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      setStatus('error');
      setErrorMsg('Video recording is not supported on this browser. You can still take photos or use the gallery.');
      return;
    }

    const mimeType = pickVideoMime();
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      setStatus('error');
      setErrorMsg('Video recording failed to start. Please try again.');
      return;
    }

    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const type = recorder.mimeType || mimeType || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      setRecording(false);
      setRecordSeconds(0);

      if (!blob.size) {
        setStatus('error');
        setErrorMsg('The recording came back empty. Please try again.');
        return;
      }

      const file = new File([blob], `story-${Date.now()}.${ext}`, { type });
      stopStream();
      onCaptured(file, URL.createObjectURL(file), 'video');
    };

    recorder.start(250); // gather data every 250ms for a clean final blob

    setRecording(true);
    setRecordSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_VIDEO_SECONDS) stopRecording(); // hard cap at 60s
        return next;
      });
    }, 1000);
  };

  const handleShutter = () => {
    if (recording) {
      stopRecording();
    } else if (mode === 'video') {
      startRecording();
    } else {
      handleCapturePhoto();
    }
  };

  const formatSeconds = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-dark-950 via-[#2a1655] to-dark-950 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={onCancel}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-all active:scale-95"
          aria-label="Close camera"
        >
          <FiX className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold tracking-wide text-white/90">New Story</p>
        {status === 'live' ? (
          <button
            onClick={switchCamera}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-all active:scale-95 disabled:opacity-40"
            aria-label="Switch camera"
            title="Switch camera"
            disabled={recording}
          >
            <FiRefreshCw className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Camera area */}
      <div className="flex-1 relative flex items-center justify-center px-4 overflow-hidden">
        {status === 'starting' && (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-secondary-400 animate-spin" />
            <p className="text-sm">Starting camera…</p>
          </div>
        )}

        {status === 'live' && (
          <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-2xl shadow-black/50">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            />
            {/* Corner accents */}
            <div className="absolute inset-3 rounded-2xl pointer-events-none border border-white/10" />

            {/* Recording indicator + timer */}
            {recording && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold tabular-nums">{formatSeconds(recordSeconds)}</span>
                <span className="text-[10px] text-white/60">max 0:60</span>
              </div>
            )}
          </div>
        )}

        {status === 'denied' && (
          <div className="text-center max-w-xs animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mb-4">
              <FiX className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold mb-2">Camera access is required to capture a story.</p>
            <p className="text-sm text-white/60 mb-6">
              Allow camera access in your browser settings, or upload a photo or video from your gallery instead.
            </p>
            <button
              onClick={onUseGallery}
              className="w-full btn-secondary text-sm inline-flex items-center justify-center gap-2"
            >
              <FiImage className="w-4 h-4" /> Use Gallery Instead
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center max-w-xs animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mb-4">
              <FiX className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold mb-2">Camera unavailable</p>
            <p className="text-sm text-white/60 mb-6">{errorMsg}</p>
            <button
              onClick={onUseGallery}
              className="w-full btn-secondary text-sm inline-flex items-center justify-center gap-2"
            >
              <FiImage className="w-4 h-4" /> Use Gallery Instead
            </button>
          </div>
        )}
      </div>

      {/* Mode switch (photo / video) */}
      {status === 'live' && (
        <div className="flex items-center justify-center gap-2 pb-1">
          <div className="flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur">
            <button
              onClick={() => setMode('photo')}
              disabled={recording}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === 'photo' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'
              } disabled:opacity-40`}
            >
              <FiImage className="w-3.5 h-3.5" /> Photo
            </button>
            <button
              onClick={() => setMode('video')}
              disabled={recording}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                mode === 'video' ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'
              } disabled:opacity-40`}
            >
              <FiVideo className="w-3.5 h-3.5" /> Video
            </button>
          </div>
        </div>
      )}

      {/* Capture controls */}
      <div className="flex items-center justify-center py-6">
        {status === 'live' ? (
          <button
            onClick={handleShutter}
            aria-label={recording ? 'Stop recording' : mode === 'video' ? 'Start recording' : 'Capture photo'}
            className="group relative flex items-center justify-center"
          >
            <span className={`absolute w-[72px] h-[72px] rounded-full blur-md transition-all ${
              recording
                ? 'bg-red-500/30'
                : mode === 'video'
                  ? 'bg-red-400/15 group-hover:bg-red-400/30'
                  : 'bg-secondary-400/20 group-hover:bg-secondary-400/40'
            }`} />
            {recording ? (
              // Stop button while recording
              <span className="relative w-16 h-16 rounded-full border-4 border-red-400/90 flex items-center justify-center active:scale-90 transition-transform">
                <FiSquare className="w-6 h-6 text-white fill-white" />
              </span>
            ) : (
              <span className="relative w-16 h-16 rounded-full border-4 border-white/90 flex items-center justify-center group-active:scale-90 transition-transform">
                <span className={`w-12 h-12 rounded-full group-active:scale-75 transition-transform shadow-lg ${
                  mode === 'video'
                    ? 'rounded-[14px] bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/40'
                    : 'bg-gradient-to-br from-secondary-300 to-secondary-500 shadow-secondary-500/40'
                }`} />
              </span>
            )}
          </button>
        ) : (
          <div className="h-16" />
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
