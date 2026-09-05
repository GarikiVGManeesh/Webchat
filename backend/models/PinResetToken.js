const mongoose = require('mongoose');

/**
 * Single-use, expiring token for Privacy PIN resets.
 * Only the SHA-256 hash of the token is stored (never the raw token),
 * and the token is tied to the user who requested it.
 */
const PinResetTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 900, // TTL index: auto-delete 15 minutes after creation
  },
});

module.exports = mongoose.model('PinResetToken', PinResetTokenSchema);