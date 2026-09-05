import { useEffect, useRef, useCallback, useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from './MessageBubble';
import { MessageSkeleton } from '../common/LoadingSkeleton';
import { FiMessageSquare } from 'react-icons/fi';

const MessageList = ({ onEditMessage, onReplyMessage, onDeleteMessage, onForwardMessage, highlightedMessageId }) => {
  const { messages, loadingMessages, activeChat, typingUsers, onlineUsers, loadMessages } = useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const prevMessageCount = useRef(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loadingMessages, activeChat?._id]);

  // Show/hide scroll-to-bottom button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to highlighted message when search result is selected
  useEffect(() => {
    if (!highlightedMessageId || !containerRef.current) return;

    const messageElement = containerRef.current.querySelector(
      `[data-message-id="${highlightedMessageId}"]`
    );

    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedMessageId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if a message is from the current user
  const isSentByMe = useCallback((message) => {
    return message.sender?._id === user?._id || message.sender === user?._id;
  }, [user?._id]);

  // Check if we should show avatar for a message
  const shouldShowAvatar = (index) => {
    if (index >= messages.length - 1) return true;
    const currentMsg = messages[index];
    const nextMsg = messages[index + 1];
    return currentMsg.sender?._id !== nextMsg.sender?._id;
  };

  const getSenderForMessage = (message) => {
    if (typeof message.sender === 'object') return message.sender;
    return null;
  };

  const isTyping = typingUsers[activeChat?._id];
  const otherUser = activeChat?.participants?.find((p) => p._id !== user?._id);
  const isOtherOnline = onlineUsers.includes(otherUser?._id);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-dark-800 relative chat-wallpaper min-h-0 scroll-smooth"
    >
      <div className="flex flex-col">
      {/* Loading */}
      {loadingMessages ? (
        <MessageSkeleton />
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-4">
            <FiMessageSquare className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {otherUser?.name || 'Chat'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            {isOtherOnline ? 'Online' : 'Offline'} · No messages yet. Say hello!
          </p>
          <div className="mt-6 text-xs text-gray-400 dark:text-gray-500 px-4 py-2 bg-gray-50 dark:bg-dark-700 rounded-lg">
            Messages are end-to-end encrypted. No one outside this chat can read them.
          </div>
        </div>
      ) : (
        <>
          {/* Date separator for first message */}
          <div className="text-center mb-4">
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-dark-700 px-3 py-1 rounded-full">
              {new Date(messages[0]?.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Messages */}
          {messages.map((message, index) => (
            <div
              key={message._id}
              data-message-id={message._id}
              className={highlightedMessageId === message._id ? 'animate-highlight-flash rounded-lg' : ''}
            >
            <MessageBubble
              message={message}
              isSent={isSentByMe(message)}
              sender={getSenderForMessage(message)}
              showAvatar={shouldShowAvatar(index)}
              onDelete={onDeleteMessage}
              onEdit={onEditMessage}
              onReply={onReplyMessage}
              onForward={onForwardMessage}
            />
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-end gap-2 mb-2 animate-fade-in-up">
              <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-dark-600 flex-shrink-0" />
              <div className="bg-gray-100 dark:bg-dark-700 rounded-2xl rounded-bl-sm px-4 py-3 animate-pulse-slow">
                <div className="typing-indicator">
                  <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-typing-dot" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-typing-dot" style={{ animationDelay: '200ms' }} />
                  <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-typing-dot" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Read receipt */}
          {messages.length > 0 && isSentByMe(messages[messages.length - 1]) && messages[messages.length - 1].read && (
            <div className="text-right mt-1">
              <span className="text-[10px] text-blue-400">Read</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </>
      )}
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-20 w-10 h-10 glass rounded-full shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary-500/10 dark:hover:bg-white/10 transition-all animate-fade-in-up hover:scale-110 active:scale-95"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MessageList;
