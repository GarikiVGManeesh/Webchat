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
    // === CUSTOM NOTIFICATIONS (per-user, per-conversation) ===
    // One entry per participant who changed their notification settings for
    // THIS chat only. mode: 'all' (default, every message notifies),
    // 'mentions' (only messages mentioning @username), 'muted' (no
    // notifications at all). muteUntil powers the timed mute durations
    // (1h/8h/1 week); null means muted until turned back on. A missing entry
    // means 'all'. Each user's entry is private — see the toJSON transform.
    notificationSettings: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        mode: {
          type: String,
          enum: ['all', 'mentions', 'muted'],
          default: 'all',
        },
        muteUntil: {
          type: Date,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: hideOtherUsersNotificationSettings },
    toObject: { virtuals: true, transform: hideOtherUsersNotificationSettings },
  }
);

// === PRIVACY: notification settings are per-user and must never leak. ===
// Every chat serialization strips other participants' notification settings,
// so API responses and socket payloads only ever carry the viewer's own row.
function hideOtherUsersNotificationSettings(doc, ret) {
  const settings = ret.notificationSettings;
  if (Array.isArray(settings) && settings.length > 0) {
    // doc may be absent when serializing plain objects (e.g. lean/socket
    // payloads); fall back to filtering nothing out in that case.
    const viewerId = doc && doc.__viewerId ? doc.__viewerId.toString() : null;
    ret.notificationSettings = viewerId
      ? settings.filter(
          (s) => s.user && s.user.toString() === viewerId
        )
      : [];
  }
  return ret;
}

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

// === CUSTOM NOTIFICATION SETTINGS HELPERS (per-user, per-conversation) ===

// Get this user's notification mode for the chat ('all' when unset).
ChatSchema.methods.notificationModeFor = function (userId) {
  const id = userId.toString();
  const entry = (this.notificationSettings || []).find(
    (s) => s.user && s.user.toString() === id
  );
  if (!entry) return 'all';
  // A timed mute that has expired behaves as if it was never set.
  if (
    entry.mode === 'muted' &&
    entry.muteUntil &&
    new Date(entry.muteUntil).getTime() <= Date.now()
  ) {
    return 'all';
  }
  return entry.mode;
};

// Resolve this user's effective notification settings for the chat.
// 'muted' mode without a muteUntil means "until I turn it back on".
ChatSchema.methods.effectiveNotificationFor = function (userId) {
  const id = userId.toString();
  const mode = this.notificationModeFor(id);
  if (mode !== 'muted') {
    return { mode, isMuted: false, muteUntil: null };
  }
  const entry = (this.notificationSettings || []).find(
    (s) => s.user && s.user.toString() === id
  );
  return {
    mode: 'muted',
    isMuted: true,
    muteUntil: (entry && entry.muteUntil) || null,
  };
};

// Set this user's notification settings for the chat. mode 'all' removes the
// entry entirely (the default needs no row). A mute duration is applied by
// passing muteUntil; muting "until turned back on" passes muteUntil = null.
ChatSchema.methods.setNotificationFor = async function (userId, mode, muteUntil = null) {
  const id = userId.toString();
  const entry = (this.notificationSettings || []).find(
    (s) => s.user && s.user.toString() === id
  );

  if (mode === 'all') {
    if (entry) {
      this.notificationSettings = this.notificationSettings.filter(
        (s) => !(s.user && s.user.toString() === id)
      );
    }
  } else if (entry) {
    entry.mode = mode;
    entry.muteUntil = mode === 'muted' ? muteUntil || null : null;
  } else {
    this.notificationSettings.push({
      user: id,
      mode,
      muteUntil: mode === 'muted' ? muteUntil || null : null,
    });
  }

  await this.save();
  return this.effectiveNotificationFor(id);
};

// Serialize this chat for a specific viewer: their own notification settings
// are included, every other participant's are stripped by the transform.
ChatSchema.methods.toJSONForViewer = function (viewerId) {
  this.__viewerId = viewerId ? viewerId.toString() : null;
  try {
    return this.toJSON();
  } finally {
    delete this.__viewerId;
  }
};

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
