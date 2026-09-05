import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { chatAPI, messageAPI } from '../utils/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';
import { getPrivateNotifications } from '../utils/privacyLock';

const ChatContext = createContext(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const {
    socket,
    onlineUsers,
    joinChat,
    leaveChat,
    emitTyping,
    emitStopTyping,
    emitSendMessage,
    emitMarkAsRead,
  } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef(null);

  // Chats unlocked with the privacy PIN during THIS session only. Kept purely
  // in memory: switching away from a chat (or closing the tab/browser) locks
  // the conversation again automatically.
  const [unlockedChats, setUnlockedChats] = useState(() => new Set());

  // Load chats
  const loadChats = useCallback(async () => {
    try {
      setLoadingChats(true);
      const { data } = await chatAPI.getChats();
      setChats(data.chats || []);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  // Load messages for a chat
  const loadMessages = useCallback(async (chatId, page = 1) => {
    if (!chatId) return;
    try {
      setLoadingMessages(true);
      const { data } = await messageAPI.getMessages(chatId, { page, limit: 50 });
      
      if (page === 1) {
        setMessages(data.messages || []);
      } else {
        setMessages((prev) => [...(data.messages || []), ...prev]);
      }
      
      return data.pagination;
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Per-conversation lock helpers
  const isChatLocked = useCallback(
    (chat) =>
      !!chat &&
      (chat.lockedBy || []).some((id) => id.toString() === user?._id?.toString()),
    [user?._id]
  );

  const isChatUnlocked = useCallback(
    (chatId) => unlockedChats.has(chatId),
    [unlockedChats]
  );

  const unlockChat = useCallback((chatId) => {
    setUnlockedChats((prev) => {
      const next = new Set(prev);
      next.add(chatId);
      return next;
    });
  }, []);

  const relockChat = useCallback((chatId) => {
    setUnlockedChats((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  }, []);

  // Select a chat
  const selectChat = useCallback(async (chat) => {
    // Leaving the current conversation re-locks it (if it was locked).
    setActiveChat((prev) => {
      if (prev && prev._id !== chat._id) relockChat(prev._id);
      return chat;
    });
    setMessages([]);

    // LOCKED conversations: nothing sensitive leaves the server until the user
    // authenticates — we don't fetch messages, join the socket room, or mark
    // anything read yet. unlockAndEnter() does that after the PIN check.
    if (isChatLocked(chat) && !unlockedChats.has(chat._id)) {
      return;
    }

    // Load messages
    await loadMessages(chat._id);
    
    // Join socket room
    joinChat(chat._id);
    
    // Mark messages as read
    emitMarkAsRead(chat._id);
    
    // Update unread count
    setChats((prev) =>
      prev.map((c) =>
        c._id === chat._id ? { ...c, unreadCount: 0 } : c
      )
    );
  }, [loadMessages, joinChat, emitMarkAsRead, relockChat, isChatLocked, unlockedChats]);

  // After the privacy PIN check succeeds: unlock for this session and fetch
  // the conversation's messages + join its realtime room.
  const unlockAndEnter = useCallback(async (chatId) => {
    unlockChat(chatId);
    joinChat(chatId);
    await loadMessages(chatId);
    emitMarkAsRead(chatId);
    setChats((prev) =>
      prev.map((c) => (c._id === chatId ? { ...c, unreadCount: 0 } : c))
    );
  }, [unlockChat, joinChat, loadMessages, emitMarkAsRead]);

  // Create a new chat
  const createChat = useCallback(async (userId) => {
    try {
      const { data } = await chatAPI.createChat({ userId });
      // Add to chats if not already there
      setChats((prev) => {
        const exists = prev.find((c) => c._id === data.chat._id);
        if (exists) return prev;
        return [data.chat, ...prev];
      });
      return data.chat;
    } catch (error) {
      throw error;
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async (content, replyTo = null) => {
    if (!activeChat) return;

    const messageData = {
      chatId: activeChat._id,
      content,
      replyTo,
    };

    emitSendMessage(messageData, (response) => {
      if (response.error) {
        console.error('Failed to send message:', response.error);
      }
    });
  }, [activeChat, emitSendMessage]);

  // Send file message
  const sendFileMessage = useCallback(async (formData) => {
    try {
      const { data } = await messageAPI.sendFileMessage(formData);
      const newMessage = data.message;

      // Add the sent file message to local state immediately
      if (newMessage && activeChat && newMessage.chat === activeChat._id) {
        setMessages((prev) => {
          // Avoid duplicates if socket already added it
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });
      }

      return newMessage;
    } catch (error) {
      throw error;
    }
  }, [activeChat]);

  // Handle new message from socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      // Add message to current chat if active
      if (activeChat && message.chat === activeChat._id) {
        setMessages((prev) => [...prev, message]);
      }

      // Update chat list
      setChats((prev) => {
        const updatedChats = prev.map((chat) => {
          if (chat._id === message.chat) {
            return {
              ...chat,
              lastMessage: message,
              unreadCount:
                message.sender._id !== user?._id && activeChat?._id !== message.chat
                  ? (chat.unreadCount || 0) + 1
                  : chat.unreadCount,
            };
          }
          return chat;
        });

        // Sort by updatedAt (most recent first)
        return updatedChats.sort(
          (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
        );
      });
    };

    const handleChatUpdated = (updatedChat) => {
      setChats((prev) => {
        const exists = prev.findIndex((c) => c._id === updatedChat._id);
        if (exists !== -1) {
          const newChats = [...prev];
          newChats[exists] = updatedChat;
          return newChats;
        }
        return [updatedChat, ...prev];
      });
    };

    const handleMessagesRead = ({ chatId }) => {
      // The server notifies the SENDER whose messages were just read, so the
      // messages that should flip to "read" are the ones the current user sent
      // in this chat (a message is identified by a plain id string from the
      // server, or a populated sender object from socket events).
      const isMine = (msg) =>
        msg.chat === chatId &&
        (msg.sender === user?._id || msg.sender?._id === user?._id);

      setMessages((prev) =>
        prev.map((msg) => (isMine(msg) ? { ...msg, read: true, readAt: new Date() } : msg))
      );

      // Keep the sidebar preview tick in sync too.
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === chatId && chat.lastMessage && isMine(chat.lastMessage)
            ? { ...chat, lastMessage: { ...chat.lastMessage, read: true } }
            : chat
        )
      );
    };

    const handleMessageNotification = ({ message, sender, chat }) => {
      if (sender?._id === user?._id || activeChat?._id === message.chat) return;

      const chatRow = chat || chats.find((c) => c._id === message.chat);
      const isMuted = (chatRow?.mutedBy || []).some((id) => id.toString() === user?._id?.toString());
      const isLocked = (chatRow?.lockedBy || []).some((id) => id.toString() === user?._id?.toString());

      if (isMuted) {
        loadChats();
        return;
      }

      // Locked conversations never leak message content or the sender's name
      // in notifications — even inside the app.
      if (isLocked && !unlockedChats.has(message.chat)) {
        toast('🔒 New private message', { icon: '🔒' });
        loadChats();
        return;
      }

      if (getPrivateNotifications()) {
        toast(`${sender?.name || 'New message'}: New message`, { icon: '💬' });
      } else {
        toast(`${sender?.name || 'New message'}: ${message.content || 'Sent an attachment'}`, { icon: '💬' });
      }
      loadChats();
    };

    const handleMessageEdited = ({ messageId, content, editedAt }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, content, editedAt }
            : msg
        )
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    };

    // === REACTIONS (Feature 1) ===
    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      );
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('chatUpdated', handleChatUpdated);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messageNotification', handleMessageNotification);
    socket.on('reactionUpdated', handleReactionUpdated);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('chatUpdated', handleChatUpdated);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messageNotification', handleMessageNotification);
      socket.off('reactionUpdated', handleReactionUpdated);
    };
  }, [socket, activeChat, user?._id, loadChats, chats, unlockedChats]);

  // Handle typing events
  useEffect(() => {
    if (!socket) return;

    const handleTyping = ({ chatId, userId: typingUserId }) => {
      if (typingUserId !== user?._id) {
        setTypingUsers((prev) => ({ ...prev, [chatId]: typingUserId }));
      }
    };

    const handleStopTyping = ({ chatId, userId }) => {
      setTypingUsers((prev) => {
        const newTyping = { ...prev };
        delete newTyping[chatId];
        return newTyping;
      });
    };

    socket.on('userTyping', handleTyping);
    socket.on('userStoppedTyping', handleStopTyping);

    return () => {
      socket.off('userTyping', handleTyping);
      socket.off('userStoppedTyping', handleStopTyping);
    };
  }, [socket, user?._id]);

  // Search messages
  const searchMessages = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const { data } = await messageAPI.searchMessages({ q: query });
      setSearchResults(data.messages || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Mark messages as read
  const markAsRead = useCallback((chatId) => {
    emitMarkAsRead(chatId);
  }, [emitMarkAsRead]);

  const value = {
    chats,
    activeChat,
    messages,
    loadingChats,
    loadingMessages,
    typingUsers,
    searchResults,
    isSearching,
    messagesEndRef,
    onlineUsers,
    isChatLocked,
    isChatUnlocked,
    unlockChat,
    relockChat,
    unlockAndEnter,
    loadChats,
    loadMessages,
    selectChat,
    createChat,
    sendMessage,
    sendFileMessage,
    searchMessages,
    markAsRead,
    setActiveChat,
    emitTyping,
    emitStopTyping,
    setMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export default ChatContext;
