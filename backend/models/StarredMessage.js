const mongoose = require('mongoose');

// === STARRED MESSAGES (saved messages) ===
// One document per (user, message) pair — a user can star a message only once.
// The `chat` field is denormalized so a user's whole starred list is one query
// and cleanup (clear chat / delete group) can remove dangling references.
const StarredMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate stars (one user can star a message only once)
StarredMessageSchema.index({ user: 1, message: 1 }, { unique: true });
// Fast "my starred messages, newest first" listing
StarredMessageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('StarredMessage', StarredMessageSchema);