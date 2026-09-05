import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { formatMessageTime, getFileIconColor, formatFileSize, getFileNameFromUrl } from '../../utils/helpers';
import { FiCheck, FiDownload, FiFile, FiTrash2, FiEdit2, FiCornerUpLeft, FiMoreVertical, FiShare2, FiMapPin, FiClock, FiPlus } from 'react-icons/fi';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Extended emoji set for the full picker
const EXTENDED_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💯', '👀',
  '🤔', '😍', '👏', '🙌', '💪', '✨', '🥳', '😅', '🤗', '😱',
  '💀', '🫡', '🤝', '❤️‍🔥', '🥹', '😤', '🫠', '💕', '🙄', '😈',
];

const MessageBubble = ({ message, isSent, sender, onDelete, onEdit, onReply, onForward, showAvatar = true }) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [newlyAddedReaction, setNewlyAddedReaction] = useState(null);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const { user } = useAuth();
  const { emitAddReaction, emitRemoveReaction } = useSocket();
  const longPressRef = useRef(null);
  const bubbleRef = useRef(null);
  const prevReactionsRef = useRef(message.reactions?.length || 0);

  // Track newly added reactions for bounce animation
  useEffect(() => {
    const currentCount = message.reactions?.length || 0;
    if (currentCount > prevReactionsRef.current) {
      const latestReaction = message.reactions[message.reactions.length - 1];
      setNewlyAddedReaction(latestReaction?.emoji);
      const timer = setTimeout(() => setNewlyAddedReaction(null), 500);
      return () => clearTimeout(timer);
    }
    prevReactionsRef.current = currentCount;
  }, [message.reactions]);

  // Close panels on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
        setShowActions(false);
        setShowReactions(false);
        setShowFullPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Double-click to show reactions (desktop)
  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    setShowReactions(true);
    setShowActions(false);
  }, []);

  // Long-press for mobile
  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      setShowReactions(true);
      setShowActions(false);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const handleDelete = () => {
    if (onDelete) onDelete(message._id);
    setShowActions(false);
  };

  const handleEdit = () => {
    if (onEdit) onEdit(message);
    setShowActions(false);
  };

  const handleReply = () => {
    if (onReply) onReply(message);
    setShowActions(false);
  };

  const handleForward = () => {
    if (onForward) onForward(message);
    setShowActions(false);
  };

  const handleReaction = (emoji) => {
    // Check if user already reacted with this emoji
    const existing = message.reactions?.find(
      (r) => r.user === user?._id || r.user?._id === user?._id
    );
    if (existing && existing.emoji === emoji) {
      emitRemoveReaction(message._id);
    } else {
      emitAddReaction(message._id, emoji);
    }
    setShowReactions(false);
    setShowFullPicker(false);
  };

  // Format vanish time for tooltip
  const formatVanishTime = (expiresAt) => {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    const now = new Date();
    const diff = date - now;

    if (diff <= 0) return 'Expiring...';
    if (diff < 60000) return `Disappears in ${Math.ceil(diff / 1000)}s`;
    if (diff < 3600000) return `Disappears in ${Math.ceil(diff / 60000)}m`;
    if (diff < 86400000) return `Disappears in ${Math.ceil(diff / 3600000)}h`;
    return `Disappears ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // === RENDER LOCATION (Feature 9) ===
  const renderLocation = () => {
    if (message.messageType !== 'location' || !message.location?.latitude) return null;
    const { latitude, longitude, address } = message.location;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.005},${latitude - 0.005},${longitude + 0.005},${latitude + 0.005}&layer=mapnik&marker=${latitude},${longitude}`;

    return (
      <div className="mb-2 rounded-xl overflow-hidden">
        <iframe
          src={mapUrl}
          width="250"
          height="150"
          frameBorder="0"
          className="rounded-lg w-full"
          title="Shared location"
          loading="lazy"
        />
        {address && (
          <p className="text-xs mt-1 opacity-80 flex items-center gap-1">
            <FiMapPin className="w-3 h-3" /> {address}
          </p>
        )}
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline opacity-75 hover:opacity-100"
        >
          Open in Maps
        </a>
      </div>
    );
  };

  const renderFilePreview = () => {
    if (!message.file?.url) return null;

    if (message.messageType === 'image') {
      return (
        <div className="mb-2 rounded-xl overflow-hidden w-[250px]">
          <img
            src={message.file.url}
            alt="Shared image"
            className="w-full h-auto max-h-72 object-cover cursor-pointer hover:opacity-95 transition-opacity rounded-lg"
            loading="lazy"
            onClick={() => window.open(message.file.url, '_blank')}
          />
        </div>
      );
    }

    if (message.messageType === 'video') {
      return (
        <div className="mb-2 rounded-xl overflow-hidden w-full">
          <video src={message.file.url} controls className="w-full max-h-72 rounded-lg" preload="metadata">
            Your browser does not support video.
          </video>
        </div>
      );
    }

    if (message.messageType === 'audio') {
      return (
        <div className="mb-2 w-full min-w-[220px]">
          <audio src={message.file.url} controls className="w-full h-10">
            Your browser does not support audio.
          </audio>
          {message.file.duration && (
            <span className="text-[10px] opacity-60">{Math.round(message.file.duration)}s</span>
          )}
        </div>
      );
    }

    // Generic file
    return (
      <a
        href={message.file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-xl bg-white/20 hover:bg-white/30 transition-all mb-2"
      >
        <div className={`p-2 rounded-lg bg-white/20 ${getFileIconColor(message.file.mimeType)}`}>
          <FiFile className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {message.file.originalName || getFileNameFromUrl(message.file.url)}
          </p>
          <p className="text-xs opacity-75">{formatFileSize(message.file.size)}</p>
        </div>
        <FiDownload className="w-4 h-4 flex-shrink-0" />
      </a>
    );
  };

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;
    const reply = message.replyTo;

    return (
      <div className={`mb-2 px-3 py-2 rounded-lg text-xs ${
        isSent ? 'bg-primary-600/50' : 'bg-gray-200 dark:bg-dark-600/50'
      }`}>
        <p className={`font-medium mb-0.5 ${isSent ? 'text-primary-200' : 'text-gray-500 dark:text-gray-400'}`}>
          {reply.sender?.name || 'Unknown'}
        </p>
        <p className={`truncate ${isSent ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'}`}>
          {reply.messageType === 'image' ? '📷 Photo'
            : reply.messageType === 'video' ? '🎥 Video'
            : reply.messageType === 'location' ? '📍 Location'
            : reply.content || '📎 File'}
        </p>
      </div>
    );
  };

  // === RENDER REACTIONS (Enhanced) ===
  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    // Group reactions by emoji
    const grouped = {};
    message.reactions.forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      const userName = r.user?.name || r.user?.username || 'Someone';
      grouped[r.emoji].push({ id: r.user?._id || r.user, name: userName });
    });

    return (
      <div className={`flex flex-wrap gap-1 mt-1.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
        {Object.entries(grouped).map(([emoji, users]) => {
          const isOwnReaction = users.some((u) => u.id === user?._id);
          const isNew = newlyAddedReaction === emoji;
          const isHovered = hoveredReaction === emoji;

          return (
            <div key={emoji} className="relative">
              <button
                onClick={() => handleReaction(emoji)}
                onMouseEnter={() => setHoveredReaction(emoji)}
                onMouseLeave={() => setHoveredReaction(null)}
                className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs border transition-all duration-200 ${
                  isOwnReaction
                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-400 dark:border-primary-500 ring-1 ring-primary-300 dark:ring-primary-600 shadow-sm shadow-primary-200 dark:shadow-primary-900/20'
                    : 'bg-gray-100 dark:bg-dark-600 border-gray-200 dark:border-dark-500 hover:border-gray-300 dark:hover:border-dark-400'
                } hover:scale-110 active:scale-95 ${isNew ? 'animate-reaction-bounce' : ''}`}
              >
                <span className={`transition-transform duration-200 ${isHovered ? 'scale-125' : ''}`}>
                  {emoji}
                </span>
                {users.length > 1 && (
                  <span className={`text-[10px] font-medium ${
                    isOwnReaction ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {users.length}
                  </span>
                )}
              </button>

              {/* Tooltip with names on hover */}
              {isHovered && (
                <div className={`absolute bottom-full mb-1.5 ${isSent ? 'right-0' : 'left-0'} z-30 pointer-events-none`}>
                  <div className="bg-gray-900 dark:bg-dark-950 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap animate-fade-in">
                    {users.map((u) => u.id === user?._id ? 'You' : u.name).join(', ')}
                    <div className={`absolute top-full ${isSent ? 'right-3' : 'left-3'} w-2 h-2 bg-gray-900 dark:bg-dark-950 transform rotate-45 -translate-y-1`} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // === FULL EMOJI PICKER ===
  const renderFullEmojiPicker = () => {
    if (!showFullPicker) return null;

    return (
      <div className={`absolute -top-[180px] ${isSent ? 'right-0' : 'left-0'} z-30 bg-white dark:bg-dark-700 rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-600 p-3 animate-fade-in-scale`}>
        <div className="grid grid-cols-6 gap-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
          {EXTENDED_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="text-xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-teal-500/10 dark:hover:bg-white/5 hover:scale-125 transition-all duration-150"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const statusIcon = () => {
    if (!isSent) return null;
    if (message.read) return (
      <span className="flex -space-x-1">
        <FiCheck className="w-3.5 h-3.5 text-blue-400" />
        <FiCheck className="w-3.5 h-3.5 text-blue-400 -ml-1.5" />
      </span>
    );
    if (message.delivered) return (
      <span className="flex -space-x-1">
        <FiCheck className="w-3.5 h-3.5" />
        <FiCheck className="w-3.5 h-3.5 -ml-1.5" />
      </span>
    );
    return <FiCheck className="w-3.5 h-3.5" />;
  };

  return (
    <div className={`flex items-end gap-2 mb-2 group ${isSent ? 'justify-end animate-message-in-right' : 'justify-start animate-message-in-left'}`}>
      {/* Other user's avatar */}
      {!isSent && showAvatar && (
        <div className="flex-shrink-0 mb-1">
          {sender?.avatar ? (
            <img src={sender.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-dark-600" />
          )}
        </div>
      )}

      {!isSent && !showAvatar && <div className="w-7 flex-shrink-0" />}

      {/* Actions (on hover) */}
      {isSent && (
        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${showActions ? 'opacity-100' : ''}`}>
          <button onClick={() => setShowActions(!showActions)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiMoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message content */}
      <div
        ref={bubbleRef}
        className="relative max-w-[75%]"
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        {/* Forwarded label */}
        {message.isForwarded && (
          <p className={`text-[10px] italic mb-0.5 flex items-center gap-1 animate-fade-in ${isSent ? 'text-white/60' : 'text-gray-400'}`}>
            <FiShare2 className="w-3 h-3" /> Forwarded
          </p>
        )}

        {/* Reply preview */}
        {message.replyTo && renderReplyPreview()}

        {/* Location */}
        {message.messageType === 'location' && renderLocation()}

        {/* File/Media preview */}
        {message.file?.url && renderFilePreview()}

        {/* Text content */}
        {message.content && message.messageType !== 'location' && (
          <div className={`message-bubble ${
            isSent ? 'message-bubble-sent' : 'message-bubble-received'
          }`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
            {message.editedAt && (
              <span className="text-[10px] opacity-60 ml-1">(edited)</span>
            )}
          </div>
        )}

        {/* Reactions */}
        {renderReactions()}

        {/* Reaction picker (quick reactions) */}
        {showReactions && (
          <div className={`absolute -top-12 ${isSent ? 'right-0' : 'left-0'} z-20 bg-white dark:bg-dark-700 rounded-full shadow-2xl border border-gray-200 dark:border-dark-600 flex items-center gap-0.5 px-2 py-1.5 animate-fade-in-scale`}>
            {QUICK_REACTIONS.map((emoji, index) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="text-lg hover:scale-150 transition-all duration-200 p-1 hover:-translate-y-1.5 rounded-full hover:bg-teal-500/10 dark:hover:bg-white/5"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {emoji}
              </button>
            ))}
            {/* "+" button for full picker */}
            <button
              onClick={() => { setShowFullPicker(!showFullPicker); setShowReactions(false); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-teal-500/10 dark:bg-white/5 hover:bg-teal-500/20 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-all hover:scale-110 ml-0.5"
            >
              <FiPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Full emoji picker */}
        {renderFullEmojiPicker()}

        {/* Actions dropdown */}
        {showActions && (
          <div className={`absolute -top-12 ${isSent ? 'right-0' : 'left-0'} z-10 bg-white dark:bg-dark-700 rounded-lg shadow-xl border border-gray-200 dark:border-dark-600 flex animate-scale-in`}>
            <button onClick={() => { setShowReactions(!showReactions); setShowActions(false); }} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5 rounded-l-lg" title="React">
              😊
            </button>
            {isSent && !message.editedAt && message.messageType === 'text' && (
              <button onClick={handleEdit} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5" title="Edit">
                <FiEdit2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleReply} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5" title="Reply">
              <FiCornerUpLeft className="w-4 h-4" />
            </button>
            <button onClick={handleForward} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-teal-500/10 dark:hover:bg-white/5" title="Forward">
              <FiShare2 className="w-4 h-4" />
            </button>
            {isSent && (
              <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-r-lg" title="Delete">
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Timestamp, Status & Vanish Indicator */}
        <div className={`flex items-center gap-1 mt-0.5 ${isSent ? 'justify-end' : 'justify-start'} px-1`}>
          {isSent && statusIcon()}

          {/* Vanish/Disappearing message indicator */}
          {message.expiresAt && (
            <div className="relative group/vanish">
              <FiClock className={`w-3 h-3 ${isSent ? 'text-white/50' : 'text-gray-400 dark:text-gray-500'} animate-vanish-pulse`} />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/vanish:block z-30 pointer-events-none">
                <div className="bg-gray-900 dark:bg-dark-950 text-white text-[10px] px-2 py-1 rounded-md shadow-lg whitespace-nowrap animate-fade-in">
                  {formatVanishTime(message.expiresAt)}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-900 dark:bg-dark-950 transform rotate-45 -translate-y-0.5" />
                </div>
              </div>
            </div>
          )}

          <span className={`text-[10px] ${isSent ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
      </div>

      {/* Actions for received messages */}
      {!isSent && (
        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${showActions ? 'opacity-100' : ''}`}>
          <button onClick={() => setShowActions(!showActions)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <FiMoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
