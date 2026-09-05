import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  isWindowFocused,
  showDesktopNotification,
  playNotificationSound,
  getNotificationPrefs,
  requestNotificationPermission,
} from '../utils/notifications';
import { APP_NAME } from '../config';
import { getPrivateNotifications } from '../utils/privacyLock';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // === DESKTOP NOTIFICATIONS — Request permission on auth ===
  useEffect(() => {
    if (isAuthenticated) {
      requestNotificationPermission();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      return;
    }

    const token = localStorage.getItem('token');

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
    });

    newSocket.on('onlineUsers', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('userOnline', ({ userId }) => {
      setOnlineUsers((prev) => {
        if (!prev.includes(userId)) return [...prev, userId];
        return prev;
      });
    });

    newSocket.on('userOffline', ({ userId }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    });

    // === ENHANCED DESKTOP NOTIFICATION on new message ===
    newSocket.on('messageNotification', ({ message, sender, chat }) => {
      // Only show notifications when the window is not focused
      if (isWindowFocused()) return;

      const prefs = getNotificationPrefs();

      const isMuted = (chat?.mutedBy || []).some(
        (id) => id.toString() === user?._id?.toString()
      );
      const isLocked = (chat?.lockedBy || []).some(
        (id) => id.toString() === user?._id?.toString()
      );

      // Muted conversations never notify.
      if (isMuted) return;

      // Locked conversations: NEVER leak sender name or message content.
      if (isLocked) {
        if (prefs.notificationSounds) playNotificationSound();
        if (prefs.desktopNotifications) {
          showDesktopNotification({
            title: APP_NAME,
            body: '🔒 New private message',
            icon: '/mahaa-logo.svg',
            tag: message._id,
            onClick: () => {
              window.focus();
              window.dispatchEvent(
                new CustomEvent('echo:openChat', {
                  detail: { chatId: chat?._id || message.chat },
                })
              );
            },
          });
        }
        return;
      }

      const senderName = sender?.name || 'New Message';
      const messageBody =
        getPrivateNotifications()
          ? 'New message'
          : message.messageType === 'text'
            ? message.content
            : message.messageType === 'image'
              ? '📷 Photo'
              : message.messageType === 'video'
                ? '🎥 Video'
                : message.messageType === 'audio'
                  ? '🎵 Voice message'
                  : message.messageType === 'location'
                    ? '📍 Location'
                    : '📎 File';

      // Play notification sound
      if (prefs.notificationSounds) {
        playNotificationSound();
      }

      // Show desktop notification
      if (prefs.desktopNotifications) {
        showDesktopNotification({
          title: senderName,
          body: messageBody,
          icon: sender?.avatar || '/chat-icon.png',
          tag: message._id,
          onClick: () => {
            // Focus window and navigate to the chat
            window.focus();
            // Dispatch a custom event so the app can navigate to the chat
            window.dispatchEvent(
              new CustomEvent('echo:openChat', {
                detail: { chatId: chat?._id || message.chat }
              })
            );
          },
        });
      }
    });

    // === Listen for 'newMessage' as well (for in-app sound when tab is hidden) ===
    newSocket.on('newMessage', (message) => {
      // If the message is from someone else and window is not focused, play sound
      if (message.sender?._id !== user?._id && !isWindowFocused()) {
        const prefs = getNotificationPrefs();
        if (prefs.notificationSounds) {
          playNotificationSound();
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?._id]);

  // Join a chat room
  const joinChat = useCallback((chatId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('joinChat', chatId);
    }
  }, []);

  // Leave a chat room
  const leaveChat = useCallback((chatId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leaveChat', chatId);
    }
  }, []);

  // Send typing indicator
  const emitTyping = useCallback(({ chatId, receiverId }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { chatId, receiverId });
    }
  }, []);

  // Stop typing
  const emitStopTyping = useCallback(({ chatId, receiverId }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stopTyping', { chatId, receiverId });
    }
  }, []);

  // Send message
  const emitSendMessage = useCallback((messageData, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sendMessage', messageData, (response) => {
        if (callback) callback(response);
      });
    }
  }, []);

  // Mark messages as read
  const emitMarkAsRead = useCallback((chatId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('markAsRead', { chatId });
    }
  }, []);

  // Edit message
  const emitEditMessage = useCallback((messageId, content, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('editMessage', { messageId, content }, callback);
    }
  }, []);

  // Delete message
  const emitDeleteMessage = useCallback((messageId, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('deleteMessage', { messageId }, callback);
    }
  }, []);

  // === ADD REACTION ===
  const emitAddReaction = useCallback((messageId, emoji, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('addReaction', { messageId, emoji }, callback || (() => {}));
    }
  }, []);

  // === REMOVE REACTION ===
  const emitRemoveReaction = useCallback((messageId, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('removeReaction', { messageId }, callback || (() => {}));
    }
  }, []);

  // === FORWARD MESSAGE ===
  const emitForwardMessage = useCallback((messageId, targetChatId, callback) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('forwardMessage', { messageId, targetChatId }, callback || (() => {}));
    }
  }, []);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    joinChat,
    leaveChat,
    emitTyping,
    emitStopTyping,
    emitSendMessage,
    emitMarkAsRead,
    emitEditMessage,
    emitDeleteMessage,
    emitAddReaction,
    emitRemoveReaction,
    emitForwardMessage,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
