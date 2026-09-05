import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { format, isToday } from 'date-fns';
import { storyAPI } from '../../utils/api';
import { getInitials, stringToColor } from '../../utils/helpers';
import ViewersModal from './ViewersModal';
import {
  FiX, FiMoreVertical, FiEye, FiShare2, FiTrash2,
  FiBellOff, FiFlag, FiPause, FiPlay, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';

const IMAGE_DURATION = 5000; // ms per image/text story

/**
 * StoryViewer — full-screen story player.
 *
 * Props:
 *  - groups: [{ user, stories, hasUnviewed }] in tray order
 *  - startIndex: group to begin from (only navigates forward from here)
 *  - currentUserId: logged-in user id (to detect own stories)
 *  - onClose(): exit viewer
 *  - onStoryDeleted(storyId): parent removes the story from its local state
 *  - onNeedRefresh(): parent silently refetches (after mute/delete)
 */
const StoryViewer = ({ groups, startIndex, currentUserId, onClose, onStoryDeleted, onNeedRefresh }) => {
  const [gIdx, setGIdx] = useState(Math.min(Math.max(startIndex || 0, 0), groups.length - 1));
  const [sIdx, setSIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [percent, setPercent] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewersStory, setViewersStory] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  const videoRef = useRef(null);
  const tickRef = useRef(null);
  const elapsedRef = useRef(0);
  const endedRef = useRef(false);

  const minGroup = Math.min(Math.max(startIndex || 0, 0), groups.length - 1);
  const totalGroups = groups.length;

  const currentGroup = groups[Math.min(gIdx, totalGroups - 1)];
  const stories = currentGroup?.stories || [];
  const currentStory = stories[Math.min(sIdx, stories.length - 1)];
  const isOwnGroup = !!currentGroup && currentGroup.user._id === currentUserId;
  const isVideo = currentStory?.storyType === 'video';

  const storyKey = currentStory?._id;

  // ---------- helpers ----------
  const goNext = useCallback(() => {
    if (sIdx < stories.length - 1) {
      setSIdx(sIdx + 1);
    } else if (gIdx < totalGroups - 1) {
      setGIdx(gIdx + 1);
      setSIdx(0);
    } else {
      onClose();
    }
  }, [sIdx, stories.length, gIdx, totalGroups, onClose]);

  const goPrev = useCallback(() => {
    if (sIdx > 0) {
      setSIdx(sIdx - 1);
    } else if (gIdx > minGroup) {
      setGIdx(gIdx - 1);
      setSIdx(groups[gIdx - 1].stories.length - 1);
    }
  }, [sIdx, gIdx, minGroup, groups]);

  const jumpTo = (index) => {
    if (index >= 0 && index < stories.length) {
      setSIdx(index);
      setMenuOpen(false);
    }
  };

  const closeViewer = useCallback(() => {
    onClose();
  }, [onClose]);

  // ---------- mark as viewed ----------
  useEffect(() => {
    if (!storyKey || isOwnGroup) return;
    storyAPI.viewStory(storyKey).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyKey]);

  // ---------- image/text auto-advance ticker ----------
  useEffect(() => {
    elapsedRef.current = 0;
    setPercent(0);
    setPlaying(true);
    endedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyKey]);

  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    // Only image/text stories are JS-timed; videos drive their own playback.
    if (!storyKey || isVideo || !playing) return;

    tickRef.current = setInterval(() => {
      elapsedRef.current += 100;
      const pct = Math.min(100, (elapsedRef.current / IMAGE_DURATION) * 100);
      setPercent(pct);
      if (elapsedRef.current >= IMAGE_DURATION) {
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
        goNext();
      }
    }, 100);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [storyKey, playing, isVideo, goNext]);

  // ---------- video play/pause control ----------
  const tryPlayVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      // Autoplay with sound can be blocked — fall back to muted playback
      v.muted = true;
      v.play().catch(() => {});
    });
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    if (playing) {
      if (!endedRef.current) tryPlayVideo();
    } else {
      v.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, storyKey, isVideo]);

  const handleVideoEnded = () => {
    endedRef.current = true;
    goNext();
  };

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setPercent(Math.min(100, (v.currentTime / v.duration) * 100));
  };

  // ---------- hold-to-pause ----------
  const handleHoldDown = () => setPlaying(false);
  const handleHoldUp = () => {
    // Don't resume an already-ended video
    if (!(isVideo && endedRef.current)) setPlaying(true);
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e) => {
      if (showDeleteConfirm || showReport || viewersStory) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm, showReport, viewersStory, closeViewer, goNext, goPrev]);

  // ---------- actions ----------
  const handleDelete = async () => {
    if (!currentStory || deleting) return;
    setDeleting(true);
    try {
      await storyAPI.deleteStory(currentStory._id);
      toast.success('Story deleted successfully.');
      const removedId = currentStory._id;
      setShowDeleteConfirm(false);
      onStoryDeleted?.(removedId);
      closeViewer();
    } catch (err) {
      toast.error(err.message || 'Failed to delete story.');
    } finally {
      setDeleting(false);
    }
  };

  const handleMute = async () => {
    const targetId = currentGroup.user._id;
    setMenuOpen(false);
    try {
      await storyAPI.muteStories(targetId);
      toast.success(`Stories from ${currentGroup.user.name || 'this user'} muted.`);
      onNeedRefresh?.();
      closeViewer();
    } catch (err) {
      toast.error(err.message || 'Failed to mute stories.');
    }
  };

  const handleReport = async () => {
    if (!currentStory || reporting) return;
    setReporting(true);
    try {
      await storyAPI.reportStory(currentStory._id, { reason: reportReason.trim() });
      toast.success('Thanks — this story has been reported.');
      setReportReason('');
      setShowReport(false);
    } catch (err) {
      toast.error(err.message || 'Failed to report story.');
    } finally {
      setReporting(false);
    }
  };

  const handleShare = async () => {
    setMenuOpen(false);
    const shareData = {
      title: `${currentGroup.user.name} on Mahaa Verse`,
      text: `Check out ${currentGroup.user.name}'s story on Mahaa Verse!`,
      url: window.location.origin,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') toast.error('Sharing failed.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        toast.success('Link copied to clipboard.');
      } catch {
        toast.error('Unable to share.');
      }
    }
  };

  if (!currentGroup || !currentStory) return null;

  const formatStoryTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return isToday(d) ? format(d, 'h:mm a') : format(d, 'MMM d, h:mm a');
  };

  const segmentCount = stories.length;

  // ---------- media ----------
  const renderMedia = () => {
    if (currentStory.storyType === 'text') {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center px-8"
          style={{ backgroundColor: currentStory.backgroundColor || '#7C3AED' }}
        >
          <p className="text-white text-xl md:text-2xl font-medium text-center leading-relaxed max-h-[80%] overflow-y-auto scrollbar-hide">
            {currentStory.content}
          </p>
        </div>
      );
    }
    if (currentStory.storyType === 'video') {
      return (
        <video
          key={storyKey}
          ref={videoRef}
          src={currentStory.media?.url}
          className="absolute inset-0 w-full h-full object-contain"
          autoPlay
          playsInline
          onCanPlay={tryPlayVideo}
          onTimeUpdate={handleVideoTimeUpdate}
          onEnded={handleVideoEnded}
          onError={() => { endedRef.current = true; goNext(); }}
        />
      );
    }
    return (
      <img
        key={storyKey}
        src={currentStory.media?.url}
        alt="Story"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain select-none"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black flex items-center justify-center">
      <div className="relative w-full h-full sm:max-w-[430px] sm:max-h-[94vh] sm:rounded-[2rem] overflow-hidden bg-gradient-to-b from-[#171026] to-black sm:border border-white/10 shadow-2xl flex flex-col">
        {/* Background glow for premium feel */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-secondary-500/10 blur-3xl pointer-events-none" />

        {/* Progress segments */}
        <div className="absolute top-0 inset-x-0 z-20 flex gap-1 px-3 pt-3">
          {stories.map((st, i) => (
            <button
              key={st._id}
              onClick={() => jumpTo(i)}
              className="flex-1 h-[3px] rounded-full bg-white/20 overflow-hidden cursor-pointer"
              aria-label={`Go to story ${i + 1}`}
            >
              <div
                className={`h-full bg-white transition-[width] duration-100 ease-linear ${
                  i < sIdx ? 'w-full' : i === sIdx ? '' : 'w-0'
                }`}
                style={i === sIdx ? { width: `${percent}%` } : undefined}
              />
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="relative z-20 flex items-center gap-3 px-4 pt-10 pb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentGroup.user.avatar ? (
              <img src={currentGroup.user.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-secondary-400/70" />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-secondary-400/70"
                style={{ backgroundColor: stringToColor(currentGroup.user.name) }}
              >
                {getInitials(currentGroup.user.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {currentGroup.user.name}
              </p>
              <p className="text-[11px] text-white/60">
                {formatStoryTime(currentStory.createdAt)}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/90"
              aria-label="Story options"
            >
              <FiMoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#221a3d]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-scale z-30">
                {isOwnGroup ? (
                  <>
                    <button
                      onClick={() => { setViewersStory(currentStory); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors"
                    >
                      <FiEye className="w-4 h-4 text-secondary-400" /> Story Viewers
                    </button>
                    <button
                      onClick={handleShare}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors"
                    >
                      <FiShare2 className="w-4 h-4 text-primary-400" /> Share
                    </button>
                    <hr className="border-white/10" />
                    <button
                      onClick={() => { setShowDeleteConfirm(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <FiTrash2 className="w-4 h-4" /> Delete Story
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleMute}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors"
                    >
                      <FiBellOff className="w-4 h-4 text-primary-400" /> Mute Stories
                    </button>
                    <button
                      onClick={() => { setShowReport(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors"
                    >
                      <FiFlag className="w-4 h-4 text-amber-400" /> Report Story
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={closeViewer}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/90"
            aria-label="Close story viewer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Media stage */}
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0">
            {renderMedia()}
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)]" />
          </div>

          {/* Pause state indicator */}
          {!playing && !isVideo && (
            <div className="absolute inset-x-0 bottom-6 flex justify-center z-20 pointer-events-none">
              <span className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                <FiPlay className="w-5 h-5 text-white ml-0.5" />
              </span>
            </div>
          )}

          {/* Hold-to-pause center zone */}
          <div
            className="absolute inset-y-0 left-[25%] right-[25%] z-10 flex items-center justify-center"
            onPointerDown={handleHoldDown}
            onPointerUp={handleHoldUp}
            onPointerLeave={handleHoldUp}
          >
            {/* Center pause/play toggle */}
            {!isVideo && (
              <button
                onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
                className="opacity-0 hover:opacity-100 transition-opacity w-14 h-14 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <FiPause className="w-5 h-5" /> : <FiPlay className="w-5 h-5 ml-0.5" />}
              </button>
            )}
          </div>

          {/* Left / right navigation zones */}
          <button
            onClick={goPrev}
            disabled={sIdx === 0 && gIdx <= minGroup}
            className="absolute inset-y-0 left-0 w-[25%] z-10 flex items-center pl-1 disabled:opacity-0 group"
            aria-label="Previous story"
          >
            <FiChevronLeft className="w-6 h-6 text-white/0 group-hover:text-white/70 transition-colors" />
          </button>
          <button
            onClick={goNext}
            className="absolute inset-y-0 right-0 w-[25%] z-10 flex items-center justify-end pr-1 group"
            aria-label="Next story"
          >
            <FiChevronRight className="w-6 h-6 text-white/0 group-hover:text-white/70 transition-colors" />
          </button>
        </div>

        {/* Bottom timestamp */}
        <div className="relative z-20 flex items-center justify-center py-3">
          <p className="text-[11px] text-white/50">
            {isOwnGroup ? 'Your story' : `Posted ${formatStoryTime(currentStory.createdAt)}`}
          </p>
        </div>

        {/* ======== Delete confirmation ======== */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-modal-overlay">
            <div className="relative w-full max-w-xs glass rounded-[1.75rem] p-6 text-center animate-modal-in shadow-2xl" style={{ background: 'rgba(28,20,50,0.95)' }}>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mb-4">
                <FiTrash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Delete Story?</h3>
              <p className="text-sm text-white/60 mb-6">This story will be permanently removed.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-br from-red-500 to-rose-600 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======== Report modal ======== */}
        {showReport && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-modal-overlay">
            <div className="relative w-full max-w-sm glass rounded-[1.75rem] p-6 animate-modal-in shadow-2xl" style={{ background: 'rgba(28,20,50,0.95)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <FiFlag className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">Report Story</h3>
                </div>
                <button onClick={() => setShowReport(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-white/60 mb-3">Help us keep Mahaa Verse safe — why are you reporting this story?</p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value.slice(0, 300))}
                placeholder="Optional details…"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm text-white placeholder-white/40 bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowReport(false)}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-white/80 bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReport}
                  disabled={reporting}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-br from-amber-500 to-orange-600 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {reporting ? 'Reporting…' : 'Report'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======== Viewers ======== */}
        {viewersStory && (
          <ViewersModal
            storyId={viewersStory._id}
            storyOwnerName={currentGroup.user.name}
            onClose={() => setViewersStory(null)}
          />
        )}
      </div>
    </div>
  );
};

export default StoryViewer;
