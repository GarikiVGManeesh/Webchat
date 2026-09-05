import { FiX } from 'react-icons/fi';
import { getInitials, stringToColor } from '../../utils/helpers';
import { format } from 'date-fns';

/**
 * SeenByModal — Shows all users who have read a group message.
 * Triggered by clicking the "Seen by X" indicator on group messages.
 *
 * Props:
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {Function} onClose - Close handler
 * @param {Array} readBy - Array of { user: { _id, name, avatar }, readAt: Date }
 * @param {string} messageTime - The original message timestamp (for context)
 */
const SeenByModal = ({ isOpen, onClose, readBy = [], messageTime }) => {
  if (!isOpen) return null;

  const formatReadTime = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'MMM d, h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm glass rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Seen by
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {readBy.length} {readBy.length === 1 ? 'person' : 'people'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-primary-500/10 dark:hover:bg-white/5 transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* User List */}
        <div className="max-h-80 overflow-y-auto py-2 scrollbar-hide">
          {readBy.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No one has read this message yet
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {readBy.map((entry, index) => {
                const reader = entry.user || entry;
                const readAt = entry.readAt || entry.timestamp;

                return (
                  <div
                    key={reader._id || index}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-primary-500/10 dark:hover:bg-white/5 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {reader.avatar ? (
                        <img
                          src={reader.avatar}
                          alt={reader.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: stringToColor(reader.name) }}
                        >
                          {getInitials(reader.name)}
                        </div>
                      )}
                    </div>

                    {/* Name & Time */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {reader.name || 'Unknown'}
                      </p>
                      {readAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Read at {formatReadTime(readAt)}
                        </p>
                      )}
                    </div>

                    {/* Blue check indicator */}
                    <div className="flex-shrink-0">
                      <div className="flex -space-x-1">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <svg className="w-3.5 h-3.5 text-blue-400 -ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with message context */}
        {messageTime && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/50">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
              Message sent {formatReadTime(messageTime)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeenByModal;
