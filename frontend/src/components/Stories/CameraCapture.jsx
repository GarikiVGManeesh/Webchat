import { useEffect, useRef, useState, useCallback } from 'react';
import { FiX, FiRefreshCw, FiImage } from 'react-icons/fi';

/**
 * CameraCapture — full live-camera interface for taking a story photo.
 *
 * Props:
 *  - onCaptured(file, previewUrl): called after the user taps capture
 *  - onCancel(): close the whole composer
 *  - onUseGallery(): jump to the gallery upload flow
 */
const CameraCapture = ({ onCaptured, onCancel, onUseGallery }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('user');
  const [status, setStatus] = useState('starting'); // starting | live | denied | error
  const [errorMsg, setErrorMsg] = useState('');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (mode) => {
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
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('live');
    } catch (err) {
      console.error('Camera error:', err);
      // Permission denied / dismissed
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg('Camera access is required to take a photo.');
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
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    stopStream();
    await startCamera(next);
    // If the device only has one camera, startCamera keeps the old error-free
    // state; set the label optimistically.
    setFacing(next);
  };

  const handleCapture = async () => {
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
    onCaptured(file, URL.createObjectURL(file) || dataUrl);
  };

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
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-all active:scale-95"
            aria-label="Switch camera"
            title="Switch camera"
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
          </div>
        )}

        {status === 'denied' && (
          <div className="text-center max-w-xs animate-fade-in-up">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mb-4">
              <FiX className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold mb-2">Camera access is required to take a photo.</p>
            <p className="text-sm text-white/60 mb-6">
              Allow camera access in your browser settings, or upload a photo from your gallery instead.
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

      {/* Capture controls */}
      <div className="flex items-center justify-center py-8">
        {status === 'live' ? (
          <button
            onClick={handleCapture}
            aria-label="Capture photo"
            className="group relative flex items-center justify-center"
          >
            <span className="absolute w-[72px] h-[72px] rounded-full bg-secondary-400/20 blur-md group-hover:bg-secondary-400/40 transition-all" />
            <span className="relative w-16 h-16 rounded-full border-4 border-white/90 flex items-center justify-center group-active:scale-90 transition-transform">
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary-300 to-secondary-500 group-active:scale-75 transition-transform shadow-lg shadow-secondary-500/40" />
            </span>
          </button>
        ) : (
          <div className="h-16" />
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
