import { useState, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { storyAPI } from '../../utils/api';
import { FiX, FiCamera, FiImage, FiType, FiRefreshCw, FiSend } from 'react-icons/fi';
import CameraCapture from './CameraCapture';

// Media whitelist shared with the backend storyUpload middleware
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ACCEPTED_MIMES = [...IMAGE_MIMES, ...VIDEO_MIMES];
const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mov';
export const STORY_MAX_SIZE = 60 * 1024 * 1024;

const TEXT_COLORS = [
  '#7C3AED', '#6D28D9', '#8B5CF6', '#C026D3',
  '#DB2777', '#EA580C', '#F59E0B', '#0D9488',
  '#2563EB', '#111827',
];

const isAcceptedFile = (file) => {
  if (!file) return { ok: false, reason: '' };
  if (ACCEPTED_MIMES.includes(file.type)) return { ok: true };
  // Fallback to extension for browsers that report empty mime types
  const ext = (file.name || '').split('.').pop().toLowerCase();
  const ok = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov'].includes(ext);
  return ok ? { ok: true } : { ok: false, reason: 'Only JPG, PNG, WEBP images and MP4, WEBM, MOV videos are supported.' };
};

/**
 * CreateStoryModal — pick Camera / Gallery / Text and publish a new story.
 * Props: onClose(), onPosted() (story uploaded → parent reloads)
 */
const CreateStoryModal = ({ onClose, onPosted }) => {
  const [phase, setPhase] = useState('choose'); // choose | camera | cameraReview | galleryReview | text
  const [cameraNonce, setCameraNonce] = useState(0);
  const [busy, setBusy] = useState(false);

  // Media review state
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaKind, setMediaKind] = useState('image'); // image | video

  // Text story state
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState(TEXT_COLORS[0]);

  const fileInputRef = useRef(null);
  const previewUrlRef = useRef('');

  const cleanupMedia = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setMediaFile(null);
    setMediaPreview('');
  };

  const handleCaptured = (file, previewUrl) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setMediaFile(file);
    setMediaPreview(previewUrl);
    setMediaKind('image');
    setPhase('cameraReview');
  };

  const retakePhoto = () => {
    cleanupMedia();
    setCameraNonce((n) => n + 1);
    setPhase('camera');
  };

  const openGallery = () => fileInputRef.current?.click();

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;

    const check = isAcceptedFile(file);
    if (!check.ok) {
      toast.error(check.reason || 'Unsupported file type.');
      return;
    }
    if (file.size > STORY_MAX_SIZE) {
      toast.error('File too large. Maximum size is 60MB.');
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaPreview(previewUrlRef.current);
    setMediaKind(IMAGE_MIMES.includes(file.type) ? 'image' : 'video');
    setPhase('galleryReview');
  };

  const shareMedia = async () => {
    if (!mediaFile || busy) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('media', mediaFile);
      await storyAPI.createStory(formData);
      toast.success('Story shared!');
      cleanupMedia();
      setPhase('choose');
      onPosted?.();
    } catch (err) {
      toast.error(err.message || 'Failed to share your story. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareText = async () => {
    if (!textContent.trim() || busy) return;
    setBusy(true);
    try {
      await storyAPI.createTextStory({
        content: textContent.trim().slice(0, 300),
        storyType: 'text',
        backgroundColor: bgColor,
      });
      toast.success('Story shared!');
      setTextContent('');
      setPhase('choose');
      onPosted?.();
    } catch (err) {
      toast.error(err.message || 'Failed to share your story. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const closeIfIdle = () => {
    if (busy) return;
    cleanupMedia();
    onClose();
  };

  // ==================== CHOOSE SOURCE ====================
  const chooseScreen = useMemo(
    () => (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-modal-overlay" onClick={closeIfIdle} />
        <div className="relative glass rounded-[2rem] p-7 w-full max-w-sm animate-modal-in shadow-2xl">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add to Story</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Share a moment — it disappears in 24 hours.
              </p>
            </div>
            <button onClick={closeIfIdle} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all">
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <button
              onClick={() => setPhase('camera')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left bg-gradient-to-br from-primary-600 to-primary-800 text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary-500/30 group"
            >
              <div className="p-3 rounded-xl bg-white/15 group-hover:scale-110 transition-transform">
                <FiCamera className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Camera</p>
                <p className="text-xs text-white/70">Take a photo with your device camera</p>
              </div>
            </button>

            <button
              onClick={openGallery}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left glass hover:scale-[1.02] active:scale-[0.98] transition-all group"
            >
              <div className="p-3 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-300 group-hover:scale-110 transition-transform">
                <FiImage className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">Gallery</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Upload a photo or video (up to 60MB)</p>
              </div>
            </button>

            <button
              onClick={() => setPhase('text')}
              className="w-full flex items-center gap-4 p-4 rounded-2xl text-left glass hover:scale-[1.02] active:scale-[0.98] transition-all group"
            >
              <div className="p-3 rounded-xl bg-secondary-500/10 text-secondary-600 dark:text-secondary-300 group-hover:scale-110 transition-transform">
                <FiType className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">Text</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Post a colorful text status</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, busy]
  );

  // ==================== MEDIA REVIEW ====================
  const reviewScreen = (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-5 py-4 text-white">
        <button onClick={closeIfIdle} disabled={busy} className="text-sm font-medium text-white/80 hover:text-white disabled:opacity-40">
          Cancel
        </button>
        <p className="text-sm font-semibold tracking-wide">Story Preview</p>
        <div className="w-14" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        {mediaKind === 'image' ? (
          <img src={mediaPreview} alt="Story preview" className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
        ) : (
          <video src={mediaPreview} controls autoPlay muted playsInline className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
        )}
      </div>

      <div className="px-6 py-6">
        {phase === 'cameraReview' ? (
          <div className="max-w-sm mx-auto flex flex-col gap-3">
            <button
              onClick={shareMedia}
              disabled={busy}
              className="btn-primary w-full text-sm inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <FiSend className="w-4 h-4" />
              )}
              {busy ? 'Sharing…' : 'Add to Story'}
            </button>
            <button
              onClick={retakePhoto}
              disabled={busy}
              className="w-full text-sm font-medium text-gray-300 hover:text-white transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <FiRefreshCw className="w-4 h-4" /> Retake
            </button>
          </div>
        ) : (
          <div className="max-w-sm mx-auto flex flex-col gap-3">
            <button
              onClick={shareMedia}
              disabled={busy}
              className="btn-primary w-full text-sm inline-flex items-center justify-center gap-2"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <FiSend className="w-4 h-4" />
              )}
              {busy ? 'Sharing…' : 'Share to Story'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ==================== TEXT EDITOR ====================
  const textScreen = (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-overlay" onClick={closeIfIdle} />
      <div className="relative w-full max-w-sm animate-modal-in">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Text Story</h3>
          <button onClick={closeIfIdle} className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 transition-all">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div
          className="rounded-[1.75rem] aspect-[3/4] w-full flex flex-col shadow-2xl overflow-hidden transition-colors duration-300"
          style={{ backgroundColor: bgColor }}
        >
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value.slice(0, 300))}
            placeholder="Type your story…"
            autoFocus
            className="flex-1 w-full bg-transparent text-white placeholder-white/60 text-center text-lg font-medium resize-none focus:outline-none p-6"
          />
          <div className="flex items-center justify-between p-4">
            <span className="text-[11px] text-white/70">{textContent.length}/300</span>
            <button
              onClick={shareText}
              disabled={!textContent.trim() || busy}
              className="p-3 rounded-full bg-white text-gray-900 shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
              aria-label="Share story"
            >
              {busy ? (
                <span className="block w-5 h-5 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
              ) : (
                <FiSend className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-2.5 mt-4 flex-wrap">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setBgColor(color)}
              aria-label={`Background ${color}`}
              className={`w-8 h-8 rounded-full transition-all ${bgColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-dark-900 ring-gray-800 dark:ring-white scale-110' : 'hover:scale-110'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // ==================== RENDER ====================
  const renderScreen = () => {
    if (phase === 'camera') {
      return (
        <CameraCapture
          key={cameraNonce}
          onCaptured={handleCaptured}
          onCancel={closeIfIdle}
          onUseGallery={openGallery}
        />
      );
    }
    if (phase === 'cameraReview' || phase === 'galleryReview') return reviewScreen;
    if (phase === 'text') return textScreen;
    return chooseScreen;
  };

  return (
    <>
      {/* Hidden gallery input — kept mounted across all phases so the camera
          permission-denied screen can fall back to it. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={handleFileSelected}
      />
      {renderScreen()}
    </>
  );
};

export default CreateStoryModal;
