const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const StarredMessage = require('../models/StarredMessage');
const mongoose = require('mongoose');

/**
 * @desc    Get messages for a chat
 * @route   GET /api/messages/:chatId
 * @access  Private
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50, around } = req.query;

    // Verify chat exists and user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.',
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these messages.',
      });
    }

    const visibleFilter = {
      chat: chatId,
      isDeleted: false,
      deletedFor: { $ne: req.user._id },
    };

    // `around` jumps straight to the page containing a specific message — used
    // when opening a starred/search result from outside the chat so the target
    // message is loaded (and can be highlighted) even if it isn't in the most
    // recent page.
    let pageNumber = parseInt(page) || 1;
    if (around) {
      if (mongoose.Types.ObjectId.isValid(around)) {
        const target = await Message.findOne({ _id: around, ...visibleFilter });
        if (target) {
          const perPage = parseInt(limit) || 50;
          const before = await Message.countDocuments({
            chat: chatId,
            isDeleted: false,
            deletedFor: { $ne: req.user._id },
            createdAt: { $lt: target.createdAt },
          });
          pageNumber = Math.floor(before / perPage) + 1;
        }
      }
    }

    const skip = (pageNumber - 1) * parseInt(limit);

    const messages = await Message.find(visibleFilter)
      .populate('sender', 'name avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(visibleFilter);

    // Attach whether the current user starred each message on this page.
    const starredRefs = await StarredMessage.find({
      user: req.user._id,
      message: { $in: messages.map((m) => m._id) },
    }).select('message');
    const starredIds = new Set(starredRefs.map((s) => s.message.toString()));

    const withStarFlags = messages.map((m) => ({
      ...m.toJSON(),
      starred: starredIds.has(m._id.toString()),
    }));

    res.status(200).json({
      success: true,
      messages: withStarFlags.reverse(), // Reverse to get chronological order
      pagination: {
        page: pageNumber,
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a text message
 * @route   POST /api/messages
 * @access  Private
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId, content, replyTo } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide chat ID and message content.',
      });
    }

    // Verify chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.',
      });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this chat.',
      });
    }

    // New activity brings the chat back for participants who had deleted or
    // archived it (persisted when chat.save() runs below).
    chat.restoreForUsers(chat.participants);

    // Determine receiver
    const receiverId = chat.participants.find(
      (p) => p.toString() !== req.user._id.toString()
    );

    // Check if blocked
    const receiver = await User.findById(receiverId);
    if (receiver && receiver.blockedUsers.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send messages to this user.',
      });
    }

    // Create message
    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      receiver: receiverId,
      content,
      messageType: 'text',
      replyTo: replyTo || null,
    });

    // Update chat's last message
    chat.lastMessage = message._id;
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar' } });

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload and send a file message
 * @route   POST /api/messages/file
 * @access  Private
 */
exports.sendFileMessage = async (req, res, next) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide chat ID.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file.',
      });
    }

    // Verify chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found.',
      });
    }

    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized.',
      });
    }

    // New activity brings the chat back for participants who had deleted or
    // archived it (persisted when chat.save() runs below).
    chat.restoreForUsers(chat.participants);

    const receiverId = chat.participants.find(
      (p) => p.toString() !== req.user._id.toString()
    );

    // Determine message type from file
    const mimeType = req.file.mimetype;
    let messageType = 'file';
    if (mimeType.startsWith('image/')) messageType = 'image';
    else if (mimeType.startsWith('video/')) messageType = 'video';
    else if (mimeType.startsWith('audio/')) messageType = 'audio';

    // Create message with file
    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      receiver: receiverId,
      content: req.body.content || '',
      messageType,
      file: {
        url: req.file.path,
        publicId: req.file.filename || '',
        originalName: req.file.originalname || '',
        mimeType,
        size: req.file.size || 0,
      },
    });

    chat.lastMessage = message._id;
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar');

    // Push the file message through Socket.IO so the receiver(s) get it in
    // real time exactly like text messages (files/voice notes are uploaded via
    // this REST endpoint, so without this the other side never sees them until
    // they reload the chat). Each recipient's notification settings for this
    // chat decide whether they get a notification — a muted chat still
    // receives the message itself.
    const io = req.app.get('io');
    if (io) {
      const { shouldNotifyRecipient, chatPrivacyFor } = require('../config/socket');

      io.to(chatId).emit('newMessage', populatedMessage);

      const updatedChat = await Chat.findById(chatId)
        .populate('participants', 'name email avatar status lastSeen bio')
        .populate('lastMessage');
      chat.participants.forEach((pId) => {
        io.to(pId.toString()).emit('chatUpdated', updatedChat.toJSONForViewer(pId));
      });

      const senderInfo = {
        _id: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar,
      };
      const targetIds = chat.isGroup
        ? chat.participants.filter((p) => p.toString() !== req.user._id.toString())
        : receiverId
          ? [receiverId]
          : [];
      const usernameCache = new Map();
      for (const targetId of targetIds) {
        const decision = await shouldNotifyRecipient(chat, targetId, populatedMessage, usernameCache);
        if (!decision.notify) continue;
        io.to(targetId.toString()).emit('messageNotification', {
          chatId,
          chat: chatPrivacyFor(chat, targetId),
          message: populatedMessage,
          sender: senderInfo,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit a message
 * @route   PUT /api/messages/:id
 * @access  Private
 */
exports.editMessage = async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Please provide new message content.',
      });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    // Only sender can edit
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages.',
      });
    }

    // Only text messages can be edited
    if (message.messageType !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Only text messages can be edited.',
      });
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a deleted message.',
      });
    }

    message.content = content;
    message.editedAt = Date.now();
    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar');

    res.status(200).json({
      success: true,
      message: updatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete message (for self)
 * @route   DELETE /api/messages/:id
 * @access  Private
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages.',
      });
    }

    // Add user to deletedFor array
    if (!message.deletedFor.includes(req.user._id)) {
      message.deletedFor.push(req.user._id);
    }

    // If both users in a 1-on-1 chat have deleted, mark as fully deleted
    const chat = await Chat.findById(message.chat);
    if (chat && !chat.isGroup) {
      const otherParticipant = chat.participants.find(
        (p) => p.toString() !== req.user._id.toString()
      );
      if (otherParticipant && message.deletedFor.includes(otherParticipant)) {
        message.isDeleted = true;
      }
    }

    await message.save();

    // The message is gone for this user now — drop their star so the Starred
    // Messages list can never hold a broken reference.
    await StarredMessage.deleteMany({ message: message._id, user: req.user._id });

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark message as read
 * @route   PUT /api/messages/read/:chatId
 * @access  Private
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;

    // Mark all unread messages in this chat as read
    const result = await Message.updateMany(
      {
        chat: chatId,
        receiver: req.user._id,
        read: false,
      },
      {
        read: true,
        readAt: Date.now(),
        delivered: true,
        deliveredAt: Date.now(),
      }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read.',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search messages
 * @route   GET /api/messages/search
 * @access  Private
 */
exports.searchMessages = async (req, res, next) => {
  try {
    // `q` is the search term (backwards-compatible with `query`); `chatId` is
    // optional and limits the search to a single chat.
    const { q, query: altQuery, chatId } = req.query;
    const searchTerm = (q || altQuery || '').trim();

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query.',
      });
    }

    // Find all chats where user is a participant
    const chats = await Chat.find({
      participants: { $in: [req.user._id] },
    }).select('_id');

    const chatIds = chats.map((chat) => chat._id);

    // If searching inside a specific chat, verify membership first
    if (chatId && !chatIds.some((id) => id.toString() === chatId.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to search this chat.',
      });
    }

    // Search messages (scoped to the requested chat or all the user's chats)
    const messages = await Message.find({
      chat: chatId ? chatId : { $in: chatIds },
      content: { $regex: searchTerm, $options: 'i' },
      isDeleted: false,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'name avatar')
      .populate('chat', 'participants')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Star a message (save it to the user's Starred Messages)
 * @route   PUT /api/messages/:id/star
 * @access  Private
 */
exports.starMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
      });
    }

    // A message the user deleted for themselves (or that vanished) can't be starred.
    if (
      message.isDeleted ||
      (message.deletedFor || []).some(
        (id) => id.toString() === req.user._id.toString()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'This message is no longer available to star.',
      });
    }

    // Only participants of the conversation may star its messages.
    const chat = await Chat.findById(message.chat);
    if (
      !chat ||
      !chat.participants.some(
        (p) => p.toString() === req.user._id.toString()
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to star this message.',
      });
    }

    // Upsert is idempotent and the unique (user, message) index guarantees a
    // user can never star the same message twice.
    //
    // createdAt/updatedAt are intentionally NOT set here: the schema has
    // `timestamps: true`, so Mongoose injects them itself on every update
    // ($set.updatedAt + $setOnInsert.createdAt on upsert). Writing updatedAt
    // manually inside $setOnInsert as well produced TWO operators for the same
    // path, which MongoDB rejects with:
    //   "Updating the path 'updatedAt' would create a conflict at 'updatedAt'"
    // Mongoose timestamps are the single source of truth for these fields.
    await StarredMessage.updateOne(
      { user: req.user._id, message: message._id },
      {
        $setOnInsert: {
          user: req.user._id,
          message: message._id,
          chat: chat._id,
        },
      },
      { upsert: true }
    );

    res.status(200).json({ success: true, starred: true });
  } catch (error) {
    // A duplicate key (code 11000) on the (user, message) unique index means
    // the message is already starred by this user (e.g. a double click racing
    // itself) — that is success, not an error.
    if (error && error.code === 11000) {
      return res.status(200).json({ success: true, starred: true });
    }
    next(error);
  }
};

/**
 * @desc    Unstar a message
 * @route   DELETE /api/messages/:id/star
 * @access  Private
 */
exports.unstarMessage = async (req, res, next) => {
  try {
    // Harmless if not starred — removes nothing and returns success.
    await StarredMessage.deleteOne({
      user: req.user._id,
      message: req.params.id,
    });

    res.status(200).json({ success: true, starred: false });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get the current user's starred messages
 * @route   GET /api/messages/starred
 * @access  Private
 */
exports.getStarredMessages = async (req, res, next) => {
  try {
    // Strictly scoped to req.user._id — no user can ever see another user's
    // starred messages.
    const starred = await StarredMessage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({
        path: 'message',
        populate: [
          { path: 'sender', select: 'name avatar username' },
          { path: 'replyTo', select: 'content messageType file createdAt' },
        ],
      })
      .populate('chat', 'isGroup groupName groupAvatar participants');

    const items = starred
      // Message was hard-deleted or vanished — drop the entry entirely so the
      // list never shows a broken link.
      .filter((s) => s.message)
      .filter(
        (s) =>
          !s.message.isDeleted &&
          !(s.message.deletedFor || []).some(
            (id) => id.toString() === req.user._id.toString()
          )
      )
      // Chat must still exist and the user must still be a participant.
      .filter(
        (s) =>
          s.chat &&
          s.chat.participants.some(
            (p) => p.toString() === req.user._id.toString()
          )
      )
      .map((s) => ({
        _id: s._id,
        starredAt: s.createdAt,
        chat: s.chat,
        message: s.message,
      }));

    res.status(200).json({
      success: true,
      count: items.length,
      starredMessages: items,
    });
  } catch (error) {
    next(error);
  }
};
