import { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCall } from '../../context/CallContext';
import { useSocket } from '../../context/SocketContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ForwardModal from './ForwardModal';
import VanishModeToggle from './VanishModeToggle';
import MessageSearch from './MessageSearch';
import GroupInfoPanel from './GroupInfoPanel';
import { getOtherParticipant, getInitials, stringToColor, formatLastSeen } from '../../utils/helpers';
import toast from 'react-hot-toast';
import {
  FiMenu,
  FiArrowLeft,
  FiMoreVertical,
  FiPhone,
  FiVideo,
  FiSearch,
  FiTrash2,
  FiStar,
  FiArchive,
  FiUser,
  FiUsers,
  FiClock,
} from 'react-icons/fi';
import { chatAPI } from '../../utils/api';

// Helper to format vanish mode label
const getVanishLabel = (mode) => {
  switch (mode) {
    case '5min': return '5 minutes';
    case '1hr': return '1 hour';
    case '24hr': return '24 hours';
    case '7days': return '7 days';
    default: return null;
  }
};

const ChatWindow = () => {
  const {
    user
  } = useAuth();
  const {
    activeChat,
    onlineUsers,
    selectChat,
    setActiveChat,
    loadChats,
  } = useChat();
  const { sidebarOpen, setSidebarOpen } = useTheme();
  const {
    emitEditMessage,
    emitDeleteMessage,
    socket,
  } = useSocket();
  const { startCall, callState } = useCall();

  const [replyTo, setReplyTo] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showVanishToggle, setShowVanishToggle] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const otherUser = activeChat ? getOtherParticipant(activeChat, user?._id) : null;
  const isOnline = onlineUsers.includes(otherUser?._id);
  // Archive state is per user: a chat archived by someone else stays visible.
  const isArchivedChat = activeChat ? (activeChat.archivedBy || []).includes(user?._id) : false;

  // === REACTION NOTIFICATION ===
  useEffect(() => {
    if (!socket) return;

    const handleReactionNotification = ({ messageId, emoji, reactor, messageOwnerId }) => {
      // Only show if someone else reacted to YOUR message
      if (messageOwnerId === user?._id && reactor?._id !== user?._id) {
        toast(
          `${reactor?.name || 'Someone'} reacted ${emoji} to your message`,
          {
            icon: emoji,
            duration: 3000,
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#fff',
            },
          }
        );
      }
    };

    socket.on('reactionNotification', handleReactionNotification);
    return () => {
      socket.off('reactionNotification', handleReactionNotification);
    };
  }, [socket, user?._id]);

  const handleReplyMessage = (message) => {
    setReplyTo(message);
  };

  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditText(message.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    emitEditMessage(editingMessage._id, editText.trim(), (response) => {
      if (response?.error) {
        toast.error(response.error);
      } else {
        toast.success('Message edited');
      }
    });

    setEditingMessage(null);
    setEditText('');
  };

  const handleDeleteMessage = async (messageId) => {
    emitDeleteMessage(messageId, (response) => {
      if (response?.error) {
        toast.error(response.error);
      } else {
        toast.success('Message deleted');
      }
    });
  };

  const handleBack = () => {
    setActiveChat(null);
    setSidebarOpen(true);
  };

  const handlePinChat = async () => {
    try {
      await chatAPI.pinChat(activeChat._id);
      toast.success('Chat pinned');
      loadChats();
    } catch (error) {
      toast.error('Failed to pin chat');
    }
    setShowOptions(false);
  };

  const handleArchiveChat = async () => {
    const wasArchived = isArchivedChat;
    try {
      await chatAPI.archiveChat(activeChat._id);
      if (wasArchived) {
        // Unarchiving keeps the chat open; reflect the per-user change.
        setActiveChat((prev) =>
          prev && prev._id === activeChat._id
            ? { ...prev, archivedBy: (prev.archivedBy || []).filter((id) => id !== user?._id) }
            : prev
        );
        toast.success('Chat unarchived');
      } else {
        // Archiving moves the chat to your Archived section — close it.
        setActiveChat(null);
        toast.success('Chat archived');
      }
      loadChats();
    } catch (error) {
      toast.error('Failed to update chat');
    }
    setShowOptions(false);
  };

  const handleDeleteChat = async () => {
    if (!window.confirm("Delete this chat for you? It will be removed from your chat list. The other people in the chat won't be affected.")) {
      setShowOptions(false);
      return;
    }
    try {
      await chatAPI.deleteChat(activeChat._id);
      toast.success('Chat deleted');
      setActiveChat(null);
      loadChats();
    } catch (error) {
      toast.error('Failed to delete chat');
    }
    setShowOptions(false);
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Animated background bubbles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -left-4 w-72 h-72 bg-primary-200/20 dark:bg-primary-500/5 rounded-full blur-3xl animate-float" />
          <div className="absolute top-1/3 -right-10 w-96 h-96 bg-secondary-200/20 dark:bg-secondary-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s', animationDuration: '4s' }} />
          <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-accent-200/20 dark:bg-accent-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s', animationDuration: '5s' }} />
        </div>

        {/* Floating chat bubble decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Small decorative bubbles */}
          <div className="absolute top-[15%] left-[10%] animate-float" style={{ animationDelay: '0.5s', animationDuration: '4s' }}>
            <div className="w-12 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-2xl rounded-bl-sm opacity-60 transform rotate-[-8deg]" />
          </div>
          <div className="absolute top-[20%] right-[15%] animate-float" style={{ animationDelay: '1.5s', animationDuration: '3.5s' }}>
            <div className="w-16 h-10 bg-green-100 dark:bg-green-900/20 rounded-2xl rounded-br-sm opacity-50 transform rotate-[5deg]" />
          </div>
          <div className="absolute bottom-[25%] left-[8%] animate-float" style={{ animationDelay: '2.5s', animationDuration: '5s' }}>
            <div className="w-10 h-8 bg-secondary-100 dark:bg-secondary-900/20 rounded-2xl rounded-bl-sm opacity-40 transform rotate-[12deg]" />
          </div>
          <div className="absolute bottom-[15%] right-[12%] animate-float" style={{ animationDelay: '0.8s', animationDuration: '4.5s' }}>
            <div className="w-14 h-9 bg-accent-100 dark:bg-accent-900/20 rounded-2xl rounded-br-sm opacity-50 transform rotate-[-5deg]" />
          </div>
          <div className="absolute top-[45%] left-[20%] animate-float" style={{ animationDelay: '3s', animationDuration: '6s' }}>
            <div className="w-8 h-6 bg-primary-100 dark:bg-primary-900/20 rounded-xl rounded-bl-sm opacity-30 transform rotate-[8deg]" />
          </div>
          <div className="absolute top-[60%] right-[20%] animate-float" style={{ animationDelay: '1.2s', animationDuration: '3.8s' }}>
            <div className="w-11 h-7 bg-secondary-100 dark:bg-secondary-900/15 rounded-xl rounded-br-sm opacity-40 transform rotate-[-10deg]" />
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 text-center px-6 max-w-md">
          {/* Animated logo */}
          <div className="mb-8 animate-fade-in-down">
            <div className="relative inline-block">
              <div className="w-28 h-28 glass rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-primary-500/20 animate-float hover-glow transition-all duration-500 hover:scale-105">
                <img src="/mahaa-logo.svg" alt="Mahaa Verse" className="w-16 h-16" />
              </div>
              {/* Notification dot */}
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-dark-900 animate-bounce-slow" />
              {/* Ring animation */}
              <div className="absolute inset-0 w-28 h-28 rounded-3xl border-2 border-primary-300/50 dark:border-primary-500/20 animate-ping opacity-20" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          {/* Welcome text */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Welcome to <span className="gradient-text">Mahaa Verse</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed mb-8">
              Connect with friends, share moments, and stay in touch — all in real time.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <div className="flex flex-col items-center gap-2 p-3 glass rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-md">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Messages</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 glass rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-md">
              <div className="w-10 h-10 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Calls</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 glass rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-md">
              <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Stories</span>
            </div>
          </div>

          {/* Call to action */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
            <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Select a conversation to start chatting
            </p>
          </div>

          {/* Animated connection lines (decorative) */}
          <div className="mt-10 flex justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 border-2 border-white dark:border-dark-900 animate-bounce-slow" style={{ animationDelay: '0s' }} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 border-2 border-white dark:border-dark-900 animate-bounce-slow" style={{ animationDelay: '0.2s' }} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 border-2 border-white dark:border-dark-900 animate-bounce-slow" style={{ animationDelay: '0.4s' }} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-white dark:border-dark-900 animate-bounce-slow" style={{ animationDelay: '0.6s' }} />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-300 dark:text-gray-600 animate-fade-in" style={{ animationDelay: '1s', animationFillMode: 'both' }}>
            Messages, calls &amp; stories — all in real time
          </p>
        </div>
      </div>
    );
  }

  const vanishLabel = getVanishLabel(activeChat.vanishMode);

  return (
    <div className="flex-1 flex flex-col bg-white/50 dark:bg-dark-900/50 backdrop-blur-xl min-h-0 h-full overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-primary-500/10 bg-white/60 dark:bg-dark-900/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile back button */}
            <button
              onClick={handleBack}
              className="md:hidden p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FiArrowLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:block p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <FiMenu className="w-5 h-5" />
            </button>

            {/* User Avatar */}
            {otherUser?.avatar ? (
              <img
                src={otherUser.avatar}
                alt={otherUser.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: stringToColor(otherUser?.name) }}
              >
                {getInitials(otherUser?.name)}
              </div>
            )}

            {/* User Info */}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {otherUser?.name || 'Unknown'}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isOnline ? (
                    <span className="text-green-500 font-medium">Online</span>
                  ) : (
                    `Last seen ${formatLastSeen(otherUser?.lastSeen)}`
                  )}
                </p>

                {/* Vanish mode indicator in header */}
                {vanishLabel && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    <FiClock className="w-3 h-3 animate-vanish-pulse" />
                    <span className="hidden sm:inline">Disappears after {vanishLabel}</span>
                    <span className="sm:hidden">{activeChat.vanishMode}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => startCall(otherUser, 'voice')}
              disabled={!otherUser || callState !== 'idle'}
              className="p-2 text-gray-500 hover:text-green-500 dark:hover:text-green-400 hover:bg-primary-500/10 dark:hover:bg-white/5 rounded-lg transition-all hidden sm:block disabled:opacity-30 disabled:cursor-not-allowed"
              title="Voice call"
            >
              <FiPhone className="w-4 h-4" />
            </button>
            <button
              onClick={() => startCall(otherUser, 'video')}
              disabled={!otherUser || callState !== 'idle'}
              className="p-2 text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-white/5 rounded-lg transition-all hidden sm:block disabled:opacity-30 disabled:cursor-not-allowed"
              title="Video call"
            >
              <FiVideo className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 rounded-lg transition-all"
              title="Search messages"
            >
              <FiSearch className="w-4 h-4" />
            </button>

            {/* More options */}
            <div className="relative">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 rounded-lg transition-all"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>

              {showOptions && (
                <div className="absolute right-0 top-full mt-1 w-52 glass rounded-2xl shadow-xl z-50 animate-fade-in-scale overflow-hidden">
                  <div className="py-1">
                    {activeChat.isGroup && (
                      <button onClick={() => { setShowOptions(false); setShowGroupInfo(true); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 flex items-center gap-3">
                        <FiUsers className="w-4 h-4" /> Group Info
                      </button>
                    )}
                    <button onClick={() => { setShowOptions(false); window.open(`/users/${otherUser?._id}`, '_blank'); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 flex items-center gap-3">
                      <FiUser className="w-4 h-4" /> View Profile
                    </button>
                    <button onClick={handlePinChat} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 flex items-center gap-3">
                      <FiStar className="w-4 h-4" /> Pin Chat
                    </button>

                    {/* Disappearing Messages option */}
                    <button
                      onClick={() => { setShowOptions(false); setShowVanishToggle(true); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 flex items-center gap-3"
                    >
                      <FiClock className="w-4 h-4" />
                      <span className="flex-1">Disappearing Messages</span>
                      {activeChat.vanishMode && activeChat.vanishMode !== 'off' && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                          ON
                        </span>
                      )}
                    </button>

                    <button onClick={handleArchiveChat} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/5 flex items-center gap-3">
                      <FiArchive className="w-4 h-4" /> {isArchivedChat ? 'Unarchive Chat' : 'Archive Chat'}
                    </button>
                    <hr className="border-gray-100 dark:border-dark-600" />
                    <button onClick={handleDeleteChat} className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3">
                      <FiTrash2 className="w-4 h-4" /> Delete Chat
                    </button>
                  </div>
                </div>
              )}

              {/* Vanish Mode Toggle Panel */}
              {showVanishToggle && (
                <VanishModeToggle
                  chatId={activeChat._id}
                  currentMode={activeChat.vanishMode || 'off'}
                  onClose={() => setShowVanishToggle(false)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Edit message bar */}
        {editingMessage && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-dark-700">
            <div className="flex-1">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') { setEditingMessage(null); setEditText(''); }
                }}
                className="input-field py-1.5 text-sm"
                autoFocus
              />
            </div>
            <button onClick={handleSaveEdit} className="btn-primary py-1.5 px-3 text-sm">Save</button>
            <button onClick={() => { setEditingMessage(null); setEditText(''); }} className="btn-secondary py-1.5 px-3 text-sm">Cancel</button>
          </div>
        )}

        {/* In-chat search */}
        {showSearch && activeChat && (
          <MessageSearch
            chatId={activeChat._id}
            onResultSelect={(msgId) => {
              setHighlightedMessageId(msgId);
              setTimeout(() => setHighlightedMessageId(null), 2000);
            }}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>

      {/* Messages */}
      <MessageList
        onEditMessage={handleEditMessage}
        onReplyMessage={handleReplyMessage}
        onDeleteMessage={handleDeleteMessage}
        onForwardMessage={(msg) => setForwardingMessage(msg)}
        highlightedMessageId={highlightedMessageId}
      />

      {/* Input */}
      <MessageInput
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />

      {/* Forward Modal */}
      {forwardingMessage && <ForwardModal message={forwardingMessage} onClose={() => setForwardingMessage(null)} />}

      {/* Group Info Panel */}
      {showGroupInfo && activeChat?.isGroup && (
        <GroupInfoPanel
          chat={activeChat}
          onClose={() => setShowGroupInfo(false)}
          onChatUpdated={(updatedChat) => setActiveChat(updatedChat)}
        />
      )}
    </div>
  );
};

export default ChatWindow;
