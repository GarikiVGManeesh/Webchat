import { useState, useEffect } from 'react';
import { FiX, FiEye } from 'react-icons/fi';
import { storyAPI } from '../../utils/api';
import { getInitials, stringToColor } from '../../utils/helpers';
import { format } from 'date-fns';

/**
 * ViewersModal — shows everyone who viewed one of the current user's stories.
 * Props: storyId, storyOwnerName, onClose()
 */
const ViewersModal = ({ storyId, storyOwnerName, onClose }) => {
  const [viewers, setViewers] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    storyAPI
      .getStoryViewers(storyId)
      .then(({ data }) => {
        if (active) setViewers(data.viewers || []);
      })
      .catch((err) => {
        if (active) {
          setViewers([]);
          setError(err.message || 'Unable to load viewers.');
        }
      });
    return () => { active = false; };
  }, [storyId]);

  const formatViewed = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'MMM d, h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-overlay">
      <div className="relative w-full max-w-sm glass rounded-[1.75rem] overflow-hidden animate-modal-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FiEye className="w-4 h-4 text-secondary-400" />
              Story viewers
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              {viewers ? `${viewers.length} ${viewers.length === 1 ? 'view' : 'views'}` : '…'} · by {storyOwnerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="max-h-[55vh] overflow-y-auto py-2 scrollbar-hide bg-dark-950/60">
          {!viewers ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-secondary-400 animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="py-10 text-center px-6">
              {error ? (
                <p className="text-sm text-red-300">{error}</p>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <FiEye className="w-5 h-5 text-white/30" />
                  </div>
                  <p className="text-sm text-white/70">No one has viewed this story yet</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {viewers.map((entry, index) => {
                const viewer = entry.user || entry;
                return (
                  <div key={viewer._id || index} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                    {viewer.avatar ? (
                      <img src={viewer.avatar} alt={viewer.name} className="w-10 h-10 rounded-full object-cover ring-1 ring-white/20" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ring-1 ring-white/20"
                        style={{ backgroundColor: stringToColor(viewer.name) }}
                      >
                        {getInitials(viewer.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{viewer.name || 'Unknown'}</p>
                      {viewer.username && <p className="text-xs text-white/40 truncate">@{viewer.username}</p>}
                    </div>
                    {entry.viewedAt && (
                      <p className="text-[11px] text-white/50 flex-shrink-0">{formatViewed(entry.viewedAt)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewersModal;
