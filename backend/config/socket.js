const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

// Store online users: { userId: Set<socketId> }
const onlineUsers = new Map();

// Helper: calculate expiry based on vanish mode
const getExpiryDate = (vanishMode) => {
  if (!vanishMode || vanishMode === 'off') return null;
  const durations = {
    '5min': 5 * 60 * 1000,
    '1hr': 60 * 60 * 1000,
    '24hr': 24 * 60 * 60 * 1000,
    '7days': 7 * 24 * 60 * 60 * 1000,
  };
  return durations[vanishMode] ? new Date(Date.now() + durations[vanishMode]) : null;
};

// === CUSTOM NOTIFICATIONS (per-user, per-conversation) ===

// Extract @username tokens from a message's text content (username charset
// mirrors the User schema: letters, numbers, dots, underscores).
const extractMentionedUsernames = (content) => {
  if (!content || typeof content !== 'string') return new Set();
  const matches = content.match(/@([a-zA-Z0-9._]{3,20})/g) || [];
  return new Set(matches.map((m) => m.slice(1).toLowerCase()));
};

// Decide whether ONE recipient should receive a messageNotification.
// A muted chat (timed or indefinite) suppresses notifications only — the
// message itself is always delivered and never blocked or deleted.
// 'mentions' notifies only when the message text @mentions the recipient.
const shouldNotifyRecipient = async (chat, recipientId, message, usernameCache) => {
  const mode = chat.notificationModeFor(recipientId);
  if (mode === 'muted') return { notify: false, mode };

  if (mode === 'mentions') {
    const id = recipientId.toString();
    if (!usernameCache.has(id)) {
      const u = await User.findById(recipientId).select('username');
      usernameCache.set(id, (u && u.username) || '');
    }
    const username = (usernameCache.get(id) || '').toLowerCase();
    const mentioned = extractMentionedUsernames(message.content).has(username);
    return { notify: !!username && mentioned, mode };
  }

  return { notify: true, mode };
};

// Per-recipient privacy payload: the recipient sees only their OWN settings.
const chatPrivacyFor = (chat, recipientId) => {
  const effective = chat.effectiveNotificationFor(recipientId);
  return {
    _id: chat._id,
    isGroup: chat.isGroup,
    lockedBy: chat.lockedBy || [],
    mutedBy: chat.mutedBy || [],
    notification: {
      mode: effective.mode,
      isMuted: effective.isMuted,
      muteUntil: effective.muteUntil,
    },
  };
};

/**
 * Initialize Socket.IO server
 */
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'development'
        ? [...new Set([
            'http://localhost:5173',
            'http://localhost:4173',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:4173',
            'http://[::1]:5173',
            'http://[::1]:4173',
            process.env.CLIENT_URL,
          ].filter(Boolean))]
        : process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${socket.user.name} (${userId})`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join user to their personal room
    socket.join(userId);

    // Mark pending messages as delivered
    await Message.updateMany(
      { receiver: userId, delivered: false },
      { delivered: true, deliveredAt: Date.now() }
    );

    // Update user status
    await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: Date.now() });

    // Notify others
    socket.broadcast.emit('userOnline', { userId });
    socket.emit('onlineUsers', Array.from(onlineUsers.keys()));

    // === JOIN/LEAVE CHAT ROOMS ===
    socket.on('joinChat', (chatId) => {
      socket.join(chatId);
      console.log(`${socket.user.name} joined room: ${chatId}`);
    });

    socket.on('leaveChat', (chatId) => {
      socket.leave(chatId);
    });

    // === TYPING INDICATOR ===
    socket.on('typing', ({ chatId }) => {
      socket.to(chatId).emit('userTyping', { chatId, userId, name: socket.user.name });
    });

    socket.on('stopTyping', ({ chatId }) => {
      socket.to(chatId).emit('userStoppedTyping', { chatId, userId });
    });

    // === SEND MESSAGE (supports group + vanish) ===
    socket.on('sendMessage', async (data, callback) => {
      try {
        const { chatId, content, messageType, file, replyTo, location, encrypted, encryptedContent } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) return callback({ error: 'Chat not found' });

        // Only participants may send messages in a chat (a user who left the
        // group or was removed would otherwise keep a working channel).
        if (!chat.participants.some((p) => p.toString() === userId)) {
          return callback({ error: 'You are not a participant of this chat' });
        }

        // New activity brings the chat back for participants who had deleted
        // or archived it (persisted when chat.save() runs below).
        chat.restoreForUsers(chat.participants);

        // For 1-on-1 chats, check blocked
        let receiverId = null;
        if (!chat.isGroup) {
          receiverId = chat.participants.find((p) => p.toString() !== userId);
          const receiver = await User.findById(receiverId);
          if (receiver && receiver.blockedUsers.some((id) => id.toString() === userId)) {
            return callback({ error: 'You cannot send messages to this user' });
          }
        }

        // Calculate expiry for vanishing messages
        const expiresAt = getExpiryDate(chat.vanishMode);

        const messageData = {
          chat: chatId,
          sender: userId,
          receiver: receiverId || undefined,
          content: content || '',
          messageType: messageType || 'text',
          file: file || {},
          replyTo: replyTo || null,
          location: location || undefined,
          encrypted: encrypted || false,
          encryptedContent: encryptedContent || undefined,
          expiresAt,
          delivered: !chat.isGroup && receiverId && onlineUsers.has(receiverId.toString()),
          deliveredAt: !chat.isGroup && receiverId && onlineUsers.has(receiverId.toString()) ? Date.now() : undefined,
        };

        const message = await Message.create(messageData);

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name avatar')
          .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar' } });

        // Update chat's last message
        chat.lastMessage = message._id;
        await chat.save();

        // Emit to chat room
        io.to(chatId).emit('newMessage', populatedMessage);

        // Notification to receiver(s), respecting EACH recipient's own
        // notification settings for this chat. Muted chats get no notification
        // (the message itself still arrives); 'mentions' only notifies when
        // the message @mentions that recipient's username.
        const usernameCache = new Map();
        const senderInfo = { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar };
        const recipients = chat.isGroup
          ? chat.participants.filter((pId) => pId.toString() !== userId)
          : receiverId
            ? [receiverId]
            : [];
        for (const pId of recipients) {
          const decision = await shouldNotifyRecipient(chat, pId, populatedMessage, usernameCache);
          if (!decision.notify) continue;
          io.to(pId.toString()).emit('messageNotification', {
            chatId,
            chat: chatPrivacyFor(chat, pId),
            message: populatedMessage,
            sender: senderInfo,
          });
        }

        // Update chat list — each participant receives their own serialized
        // copy so notification settings never cross users.
        const updatedChat = await Chat.findById(chatId)
          .populate('participants', 'name email avatar status lastSeen bio')
          .populate('lastMessage');
        chat.participants.forEach((pId) => {
          io.to(pId.toString()).emit('chatUpdated', updatedChat.toJSONForViewer(pId));
        });

        callback({ success: true, message: populatedMessage });
      } catch (error) {
        console.error('Socket sendMessage error:', error);
        callback({ error: 'Failed to send message' });
      }
    });

    // === MESSAGE REACTIONS (Feature 1) ===
    socket.on('addReaction', async ({ messageId, emoji }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return callback({ error: 'Message not found' });

        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(
          (r) => r.user.toString() !== userId
        );
        // Add new reaction
        message.reactions.push({ emoji, user: userId });
        await message.save();

        io.to(message.chat.toString()).emit('reactionUpdated', {
          messageId,
          reactions: message.reactions,
        });

        callback({ success: true });
      } catch (error) {
        callback({ error: 'Failed to add reaction' });
      }
    });

    socket.on('removeReaction', async ({ messageId }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return callback({ error: 'Message not found' });

        message.reactions = message.reactions.filter(
          (r) => r.user.toString() !== userId
        );
        await message.save();

        io.to(message.chat.toString()).emit('reactionUpdated', {
          messageId,
          reactions: message.reactions,
        });

        callback({ success: true });
      } catch (error) {
        callback({ error: 'Failed to remove reaction' });
      }
    });

    // === FORWARD MESSAGE (Feature 3) ===
    socket.on('forwardMessage', async ({ messageId, targetChatId }, callback) => {
      try {
        const originalMessage = await Message.findById(messageId);
        if (!originalMessage) return callback({ error: 'Message not found' });

        const targetChat = await Chat.findById(targetChatId);
        if (!targetChat) return callback({ error: 'Target chat not found' });

        // Can only forward into chats the user belongs to.
        if (!targetChat.participants.some((p) => p.toString() === userId)) {
          return callback({ error: 'You are not a participant of this chat' });
        }

        // Forwarding into a chat is activity too — restore it for members who
        // had deleted/archived it (persisted when targetChat.save() runs below).
        targetChat.restoreForUsers(targetChat.participants);

        let receiverId = null;
        if (!targetChat.isGroup) {
          receiverId = targetChat.participants.find((p) => p.toString() !== userId);
        }

        const expiresAt = getExpiryDate(targetChat.vanishMode);

        const forwarded = await Message.create({
          chat: targetChatId,
          sender: userId,
          receiver: receiverId || undefined,
          content: originalMessage.content,
          messageType: originalMessage.messageType,
          file: originalMessage.file || {},
          location: originalMessage.location || undefined,
          isForwarded: true,
          forwardedFrom: originalMessage._id,
          expiresAt,
        });

        const populated = await Message.findById(forwarded._id)
          .populate('sender', 'name avatar');

        targetChat.lastMessage = forwarded._id;
        await targetChat.save();

        io.to(targetChatId).emit('newMessage', populated);

        // Forwarded messages respect the recipient's notification settings too.
        if (receiverId) {
          const decision = await shouldNotifyRecipient(
            targetChat,
            receiverId,
            populated,
            new Map()
          );
          if (decision.notify) {
            io.to(receiverId.toString()).emit('messageNotification', {
              chatId: targetChatId,
              chat: chatPrivacyFor(targetChat, receiverId),
              message: populated,
              sender: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
            });
          }
        }

        callback({ success: true, message: populated });
      } catch (error) {
        console.error('Forward error:', error);
        callback({ error: 'Failed to forward message' });
      }
    });

    // === MARK MESSAGES AS READ ===
    socket.on('markAsRead', async ({ chatId }) => {
      try {
        await Message.updateMany(
          { chat: chatId, sender: { $ne: userId }, read: false },
          { read: true, readAt: Date.now(), delivered: true, deliveredAt: Date.now() }
        );

        const chat = await Chat.findById(chatId);
        if (chat && !chat.isGroup) {
          const senderId = chat.participants.find((p) => p.toString() !== userId);
          if (senderId) {
            io.to(senderId.toString()).emit('messagesRead', { chatId, readBy: userId });
          }
        }
      } catch (error) {
        console.error('Socket markAsRead error:', error);
      }
    });

    // === EDIT MESSAGE ===
    socket.on('editMessage', async ({ messageId, content }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== userId) {
          return callback({ error: 'Cannot edit this message' });
        }

        message.content = content;
        message.editedAt = Date.now();
        await message.save();

        io.to(message.chat.toString()).emit('messageEdited', {
          messageId, content, editedAt: message.editedAt,
        });
        callback({ success: true });
      } catch (error) {
        callback({ error: 'Failed to edit message' });
      }
    });

    // === DELETE MESSAGE ===
    socket.on('deleteMessage', async ({ messageId }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.sender.toString() !== userId) {
          return callback({ error: 'Cannot delete this message' });
        }

        message.deletedFor.push(userId);
        const chat = await Chat.findById(message.chat);
        if (chat && !chat.isGroup) {
          const otherParticipant = chat.participants.find((p) => p.toString() !== userId);
          if (otherParticipant && message.deletedFor.includes(otherParticipant.toString())) {
            message.isDeleted = true;
          }
        }

        await message.save();
        io.to(message.chat.toString()).emit('messageDeleted', { messageId, deletedBy: userId });
        callback({ success: true });
      } catch (error) {
        callback({ error: 'Failed to delete message' });
      }
    });

    // === WEBRTC VOICE/VIDEO CALL SIGNALING ===
    socket.on('call:user', ({ receiverId, signalData, callType }) => {
      io.to(receiverId).emit('call:incoming', {
        callerId: userId, callerName: socket.user.name, callerAvatar: socket.user.avatar,
        signalData, callType,
      });
    });

    socket.on('call:accepted', ({ signalData, callerId }) => {
      io.to(callerId).emit('call:accepted', { signalData, accepterId: userId });
    });

    socket.on('call:rejected', ({ callerId }) => {
      io.to(callerId).emit('call:rejected', { userId });
    });

    socket.on('call:ended', ({ targetUserId }) => {
      io.to(targetUserId).emit('call:ended', { userId });
    });

    socket.on('call:unavailable', ({ callerId }) => {
      io.to(callerId).emit('call:unavailable', { userId });
    });

    socket.on('webrtc:ice-candidate', ({ candidate, targetUserId }) => {
      io.to(targetUserId).emit('webrtc:ice-candidate', { candidate, userId });
    });

    // === DISCONNECT ===
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.name} (${userId})`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: Date.now() });
          socket.broadcast.emit('userOffline', { userId, lastSeen: Date.now() });
        }
      }
      socket.leave(userId);
    });
  });

  return io;
};

let ioInstance = null;
const getIO = () => ioInstance;
const setIO = (io) => { ioInstance = io; };

module.exports = {
  initializeSocket,
  getIO,
  setIO,
  onlineUsers,
  shouldNotifyRecipient,
  chatPrivacyFor,
};
