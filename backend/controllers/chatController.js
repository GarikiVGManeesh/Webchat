const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const StarredMessage = require('../models/StarredMessage');

/**
 * @desc    Get all chats for current user
 * @route   GET /api/chats
 * @access  Private
 */
exports.getChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user._id] },
    })
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('groupAdmin', 'name avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    // A chat is hidden only when THIS user deleted it for themselves.
    // (Messages deleted by the user are handled at the message level, e.g. the
    // sidebar shows a "deleted" preview for the last message instead.)
    const filteredChats = chats.filter(
      (chat) =>
        !(chat.deletedFor || []).some(
          (id) => id.toString() === req.user._id.toString()
        )
    );

    const chatsWithUnread = await Promise.all(
      filteredChats.map(async (chat) => {
        const unreadQuery = {
          chat: chat._id,
          read: false,
          isDeleted: false,
          deletedFor: { $ne: req.user._id },
          sender: { $ne: req.user._id },
        };

        const unreadCount = await Message.countDocuments(unreadQuery);

        return {
          ...chat.toJSON(),
          unreadCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: chatsWithUnread.length,
      chats: chatsWithUnread,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single chat by ID
 * @route   GET /api/chats/:id
 * @access  Private
 */
exports.getChatById = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('groupAdmin', 'name avatar');

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    if (!chat.participants.some((p) => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    res.status(200).json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start a new one-to-one chat
 * @route   POST /api/chats
 * @access  Private
 */
exports.createChat = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Please provide user ID.' });
    }

    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot chat with yourself.' });
    }

    const currentUser = await User.findById(req.user._id);
    if (currentUser.blockedUsers.some((id) => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'You have blocked this user.' });
    }

    if (otherUser.blockedUsers.some((id) => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ success: false, message: 'This user has blocked you.' });
    }

    const chat = await Chat.findOrCreatePrivateChat(req.user._id, userId);

    res.status(201).json({ success: true, message: 'Chat started.', chat });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a group chat
 * @route   POST /api/chats/group
 * @access  Private
 */
exports.createGroupChat = async (req, res, next) => {
  try {
    const { name, participants, description } = req.body;

    if (!name || !participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group needs a name and at least 2 other participants.',
      });
    }

    // Include current user in participants
    const allParticipants = [...new Set([req.user._id.toString(), ...participants])];

    const chat = await Chat.create({
      isGroup: true,
      groupName: name,
      groupDescription: description || '',
      participants: allParticipants,
      groupAdmin: [req.user._id],
      createdBy: req.user._id,
    });

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('groupAdmin', 'name avatar');

    // Notify all participants via socket
    const io = req.app.get('io');
    if (io) {
      allParticipants.forEach((pId) => {
        io.to(pId.toString()).emit('chatUpdated', populated);
      });
    }

    res.status(201).json({ success: true, chat: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add member to group
 * @route   PUT /api/chats/group/:id/add
 * @access  Private
 */
exports.addGroupMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!chat.groupAdmin.some((a) => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Only admins can add members.' });
    }

    if (chat.participants.some((p) => p.toString() === userId)) {
      return res.status(400).json({ success: false, message: 'User already in group.' });
    }

    chat.participants.push(userId);
    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('groupAdmin', 'name avatar');

    res.status(200).json({ success: true, chat: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove member from group
 * @route   PUT /api/chats/group/:id/remove
 * @access  Private
 */
exports.removeGroupMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!chat.groupAdmin.some((a) => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Only admins can remove members.' });
    }

    chat.participants = chat.participants.filter((p) => p.toString() !== userId);
    chat.groupAdmin = chat.groupAdmin.filter((a) => a.toString() !== userId);
    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('groupAdmin', 'name avatar');

    res.status(200).json({ success: true, chat: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update group info
 * @route   PUT /api/chats/group/:id/update
 * @access  Private
 */
exports.updateGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (!chat.groupAdmin.some((a) => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Only admins can update group.' });
    }

    if (name) chat.groupName = name;
    if (description !== undefined) chat.groupDescription = description;
    if (req.file) {
      chat.groupAvatar = req.file.path;
      chat.groupAvatarPublicId = req.file.filename || '';
    }

    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('groupAdmin', 'name avatar');

    res.status(200).json({ success: true, chat: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Leave a group
 * @route   PUT /api/chats/group/:id/leave
 * @access  Private
 */
exports.leaveGroup = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    chat.participants = chat.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );
    chat.groupAdmin = chat.groupAdmin.filter(
      (a) => a.toString() !== req.user._id.toString()
    );

    // If no admins left, make the first participant admin
    if (chat.groupAdmin.length === 0 && chat.participants.length > 0) {
      chat.groupAdmin.push(chat.participants[0]);
    }

    // If no participants left, delete the group
    if (chat.participants.length === 0) {
      await Message.deleteMany({ chat: chat._id });
      await StarredMessage.deleteMany({ chat: chat._id });
      await chat.deleteOne();
      return res.status(200).json({ success: true, message: 'Group deleted (no members left).' });
    }

    await chat.save();
    res.status(200).json({ success: true, message: 'Left group successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update vanish mode for a chat
 * @route   PUT /api/chats/:id/vanish
 * @access  Private
 */
exports.updateVanishMode = async (req, res, next) => {
  try {
    const { mode } = req.body;
    const validModes = ['off', '5min', '1hr', '24hr', '7days'];

    if (!validModes.includes(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid vanish mode.' });
    }

    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    chat.vanishMode = mode;
    await chat.save();

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('vanishModeUpdated', { chatId: req.params.id, mode });
    }

    res.status(200).json({ success: true, vanishMode: mode });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pin a chat
 * @route   PUT /api/chats/pin/:id
 * @access  Private
 */
exports.pinChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    const index = chat.pinnedBy.indexOf(req.user._id);
    if (index === -1) {
      chat.pinnedBy.push(req.user._id);
    } else {
      chat.pinnedBy.splice(index, 1);
    }

    await chat.save();
    const isPinned = chat.pinnedBy.includes(req.user._id);

    res.status(200).json({ success: true, message: isPinned ? 'Pinned.' : 'Unpinned.', isPinned });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Archive a chat
 * @route   PUT /api/chats/archive/:id
 * @access  Private
 */
exports.archiveChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    if (!chat.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const userId = req.user._id.toString();
    const isArchived = (chat.archivedBy || []).some((id) => id.toString() === userId);

    if (isArchived) {
      await Chat.updateOne(
        { _id: chat._id },
        { $pull: { archivedBy: req.user._id } },
        // Don't bump updatedAt: archiving is personal and must not reorder the
        // chat list for the other participants.
        { timestamps: false }
      );
    } else {
      await Chat.updateOne(
        { _id: chat._id },
        { $addToSet: { archivedBy: req.user._id } },
        { timestamps: false }
      );
    }

    res.status(200).json({ success: true, isArchived: !isArchived });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Lock/unlock a chat for the current user (per-conversation)
 * @route   PUT /api/chats/lock/:id
 * @access  Private
 */
exports.toggleChatLock = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    if (!chat.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const userId = req.user._id.toString();
    const isLocked = (chat.lockedBy || []).some((id) => id.toString() === userId);

    if (isLocked) {
      await Chat.updateOne(
        { _id: chat._id },
        { $pull: { lockedBy: req.user._id } },
        { timestamps: false }
      );
    } else {
      await Chat.updateOne(
        { _id: chat._id },
        { $addToSet: { lockedBy: req.user._id } },
        { timestamps: false }
      );
    }

    // Refresh the acting user's chat list. Lock state is private to the user
    // who set it, so we deliberately emit only to that user — never to the
    // other participants.
    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('lastMessage');
    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('chatUpdated', populated);
    }

    res.status(200).json({ success: true, isLocked: !isLocked });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mute/unmute notifications for a chat (per-conversation, per-user)
 * @route   PUT /api/chats/mute/:id
 * @access  Private
 */
exports.toggleChatMute = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    if (!chat.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const userId = req.user._id.toString();
    const isMuted = (chat.mutedBy || []).some((id) => id.toString() === userId);

    if (isMuted) {
      await Chat.updateOne(
        { _id: chat._id },
        { $pull: { mutedBy: req.user._id } },
        { timestamps: false }
      );
    } else {
      await Chat.updateOne(
        { _id: chat._id },
        { $addToSet: { mutedBy: req.user._id } },
        { timestamps: false }
      );
    }

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('lastMessage');
    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('chatUpdated', populated);
    }

    res.status(200).json({ success: true, isMuted: !isMuted });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Clear all messages in a chat
 * @route   DELETE /api/chats/:id/clear
 * @access  Private
 */
exports.clearChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    if (!chat.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Removes the whole message history for this conversation.
    await Message.deleteMany({ chat: chat._id });
    // No messages left to star — drop the saved references so the Starred
    // Messages list never holds broken links.
    await StarredMessage.deleteMany({ chat: chat._id });

    chat.lastMessage = undefined;
    await chat.save();

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar status lastSeen bio')
      .populate('lastMessage');

    const io = req.app.get('io');
    if (io) {
      chat.participants.forEach((pId) => {
        io.to(pId.toString()).emit('chatUpdated', populated);
      });
    }

    res.status(200).json({ success: true, message: 'Chat cleared.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a chat
 * @route   DELETE /api/chats/:id
 * @access  Private
 */
exports.deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    if (!chat.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Deleting a chat only removes it from THIS user's list. The chat and its
    // messages stay intact for the other participants — it comes back when one
    // of them sends a new message.
    await Chat.updateOne(
      { _id: chat._id, deletedFor: { $ne: req.user._id } },
      { $addToSet: { deletedFor: req.user._id } },
      { timestamps: false }
    );

    res.status(200).json({ success: true, message: 'Chat deleted.' });
  } catch (error) {
    next(error);
  }
};
