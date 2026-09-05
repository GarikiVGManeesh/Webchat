const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    // Per-user archive flag. A user in this list has moved the chat to their
    // own "Archived" section; every participant keeps their own copy of the
    // chat and can archive/unarchive independently.
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Users who deleted this chat from their own chat list. The chat and its
    // messages are kept for everyone else — deleting is a per-user action and
    // the chat reappears when another participant sends a new message.
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // === GROUP CHAT (Feature 5) ===
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
      default: '',
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    groupAvatarPublicId: {
      type: String,
      default: '',
    },
    groupAdmin: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    groupDescription: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    // === VANISH MODE (Feature 6) ===
    vanishMode: {
      type: String,
      enum: ['off', '5min', '1hr', '24hr', '7days'],
      default: 'off',
    },
    // === PRIVATE CHAT LOCK (per-conversation) ===
    // Users in this list have locked THIS conversation only — other chats are
    // unaffected. The lock is per-user: one participant locking a chat never
    // locks it for the other participants.
    lockedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Users who muted notifications for this conversation.
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for messages
ChatSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'chat',
  options: { sort: { createdAt: -1 } },
});

// Index for faster queries
ChatSchema.index({ participants: 1 });
ChatSchema.index({ updatedAt: -1 });
ChatSchema.index({ isGroup: 1 });

// Clear a list of per-user flags (deletedFor/archivedBy) for the given users.
// Called whenever the chat becomes active again for those users, e.g. a new
// message is sent or one of them starts the chat again from the search screen.
ChatSchema.methods.restoreForUsers = function (userIds) {
  const ids = new Set((userIds || []).map((id) => id.toString()));

  let changed = false;
  const clean = (arr) => {
    const kept = (arr || []).filter((id) => !ids.has(id.toString()));
    if (kept.length !== (arr || []).length) changed = true;
    return kept;
  };

  this.deletedFor = clean(this.deletedFor);
  this.archivedBy = clean(this.archivedBy);
  return changed;
};

// Static method to find or create a one-to-one chat
ChatSchema.statics.findOrCreatePrivateChat = async function (userId1, userId2) {
  // Check if a private chat already exists between these two users
  let chat = await this.findOne({
    isGroup: false,
    participants: { $all: [userId1, userId2], $size: 2 },
  }).populate('participants', 'name avatar status lastSeen');

  if (!chat) {
    chat = await this.create({
      participants: [userId1, userId2],
      isGroup: false,
    });
  } else if (chat.restoreForUsers([userId1, userId2])) {
    // One of the two users had deleted/archived this chat earlier — opening it
    // again from search should bring it back into their chat list.
    await chat.save();
  }

  // Make sure participants are populated before handing the chat to the client.
  await chat.populate('participants', 'name avatar status lastSeen');

  return chat;
};

module.exports = mongoose.model('Chat', ChatSchema);
