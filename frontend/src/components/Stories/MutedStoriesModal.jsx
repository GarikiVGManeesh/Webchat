import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiX, FiBellOff, FiVolume2 } from 'react-icons/fi';
import { storyAPI } from '../../utils/api';
import { getInitials, stringToColor } from '../../utils/helpers';

/**
 * MutedStoriesModal — list users whose stories are muted and allow unmuting.
 * Props: onClose(), onUnmuted() (parent refresh)
 */
const MutedStoriesModal = ({ onClose, onUnmuted }) => {
  const [users, setUsers] = useState(null); // null = loading
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let active = true;
    storyAPI
      .getMutedStories()
      .then(({ data }) => { if (active) setUsers(data.users || []); })
      .catch(() => { if (active) setUsers([]); });
    return () => { active = false; };
  }, []);

  const handleUnmute = async (user) => {
    setBusyId(user._id);
    try {
      await storyAPI.unmuteStories(user._id);
      setUsers((prev) => (prev || []).filter((u) => u._id !== user._id));
      toast.success(`Stories from ${user.name} unmuted.`);
      onUnmuted?.();
    } catch (err) {
      toast.error(err.message || 'Failed to unmute stories.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-modal-overlay" onClick={onClose} />
      <div className="relative w-full max-w-sm glass rounded-[1.75rem] overflow-hidden animate-modal-in shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FiBellOff className="w-4 h-4 text-secondary-500" />
              Muted stories
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Their stories are hidden from your feed
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-500 dark:text-gray-400">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2 scrollbar-hide">
          {!users ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-dark-600 border-t-primary-500 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center px-6">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center mb-3">
                <FiBellOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">You haven't muted anyone's stories</p>
            </div>
          ) : (
            users.map((user) => (
              <div key={user._id} className="flex items-center gap-3 px-5 py-3 hover:bg-primary-500/5 dark:hover:bg-white/5 transition-colors">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: stringToColor(user.name) }}
                  >
                    {getInitials(user.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                  {user.username && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{user.username}</p>}
                </div>
                <button
                  onClick={() => handleUnmute(user)}
                  disabled={busyId === user._id}
                  className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 px-3 py-1.5 rounded-full border border-secondary-400/40 hover:bg-secondary-500/10 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FiVolume2 className="w-3.5 h-3.5" />
                  {busyId === user._id ? 'Unmuting…' : 'Unmute'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MutedStoriesModal;
