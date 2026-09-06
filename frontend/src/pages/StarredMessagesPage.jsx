import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { messageAPI } from '../utils/api';
import { getInitials, stringToColor, getOtherParticipant, formatMessageTime } from '../utils/helpers';
import ThemeToggle from '../components/common/ThemeToggle';
import { FiArrowLeft, FiStar, FiMessageSquare } from 'react-icons/fi';

// Preview text for non-text messages (mirrors MessageSearch)
const getPreview = (message) => {
  if (!message) return '';
  switch (message.messageType) {
    case 'image': return '📷 Photo';
    case 'video': return '🎬 Video';
    case 'audio': return '🎵 Voice note';
    case 'file': return '📎 File';
    case 'location': return '📍 Location';
    default: return message.content || '';
  }
};

const StarredMessagesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jumpToMessage } = useChat();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [unstarringId, setUnstarringId] = useState(null);

  const loadStarred = useCallback(async () => {
    try {
      const { data } = await messageAPI.getStarredMessages();
      setItems(data.starredMessages || []);
    } catch (err) {
      console.error('Failed to load starred messages:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStarred();
  }, [loadStarred]);

  // Refresh when the tab regains focus — messages deleted/starred elsewhere
  // (or expired vanish-mode messages) update the list automatically.
  useEffect(() => {
    const onFocus = () => loadStarred();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStarred]);

  const handleOpen = async (item) => {
    try {
      await jumpToMessage(item.chat._id, item.message._id);
      navigate('/chats');
    } catch (err) {
      toast.error(err.message || 'Unable to open this conversation.');
    }
  };

  const handleUnstar = async (item) => {
    if (unstarringId) return;
    setUnstarringId(item._id);
    try {
      await messageAPI.unstarMessage(item.message._id);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      toast.success('Message unstarred');
    } catch (err) {
      toast.error(err.message || 'Failed to unstar message.');
    } finally {
      setUnstarringId(null);
    }
  };

  const chatName = (chat) => {
    if (!chat) return 'Conversation';
    if (chat.isGroup) return chat.groupName || 'Group';
    return getOtherParticipant(chat, user?._id)?.name || 'Chat';
  };

  const chatAvatar = (chat, message) => {
    const sender = message?.sender;
    if (chat?.isGroup) return chat.groupAvatar || sender?.avatar || '';
    const other = getOtherParticipant(chat, user?._id);
    return other?.avatar || '';
  };

  return (
    <div className="min-h-screen page-enter flex flex-col">
      {/* Header */}
      <div className="bg-white/70 dark:bg-dark-900/60 backdrop-blur-xl border-b border-primary-500/10 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/chats')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="font-medium">Chats</span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6">
        {/* Page title */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-secondary-500 flex items-center justify-center shadow-lg shadow-amber-400/25">
            <FiStar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white gradient-text">
              Starred Messages
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Your saved messages — tap one to jump back to it.
            </p>
          </div>
        </div>

        {loading ? (
          /* Skeleton */
          <div className="space-y-3 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-3xl p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-dark-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-gray-200 dark:bg-dark-700" />
                  <div className="h-3 w-56 rounded bg-gray-100 dark:bg-dark-800" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="glass rounded-[2rem] p-10 text-center animate-fade-in-up">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400/15 to-secondary-500/15 flex items-center justify-center mb-5">
              <FiStar className="w-9 h-9 text-amber-400/70" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No starred messages yet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Tap the ⭐ star on any message to save it here — handy for things you want to keep close.
            </p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {items.map((item) => {
              const avatar = chatAvatar(item.chat, item.message);
              const senderName = item.message?.sender?.name || 'Unknown';
              return (
                <div
                  key={item._id}
                  className="glass rounded-3xl p-4 flex items-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all group"
                >
                  {/* Open original message */}
                  <button onClick={() => handleOpen(item)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="relative shrink-0">
                      {avatar ? (
                        <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: stringToColor(senderName) }}
                        >
                          {getInitials(senderName)}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center ring-2 ring-white dark:ring-dark-900">
                        <FiStar className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {senderName}
                        </p>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                          {formatMessageTime(item.message?.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        <span className="text-primary-500 dark:text-primary-300 font-medium">
                          {chatName(item.chat)}
                        </span>{' '}
                        · {getPreview(item.message) || 'Message'}
                      </p>
                    </div>
                  </button>

                  {/* Unstar */}
                  <button
                    onClick={() => handleUnstar(item)}
                    disabled={unstarringId === item._id}
                    className="p-2.5 rounded-xl text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 transition-all disabled:opacity-50"
                    title="Unstar message"
                    aria-label="Unstar message"
                  >
                    <FiStar className={`w-4 h-4 ${unstarringId === item._id ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              );
            })}

            <div className="flex justify-center pt-2">
              <p className="text-[11px] text-gray-400 dark:text-gray-600 flex items-center gap-1.5">
                <FiMessageSquare className="w-3 h-3" />
                Starred messages are private to you
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StarredMessagesPage;