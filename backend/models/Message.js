const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    content: {
      type: String,
      trim: true,
      default: '',
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'audio', 'system', 'location'],
      default: 'text',
    },
    file: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      duration: { type: Number }, // For audio/video
    },
    // === REACTIONS (Feature 1) ===
    reactions: [
      {
        emoji: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // === FORWARDING (Feature 3) ===
    isForwarded: {
      type: Boolean,
      default: false,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    // === LOCATION (Feature 9) ===
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, default: '' },
    },
    // === ENCRYPTION (Feature 7) ===
    encrypted: {
      type: Boolean,
      default: false,
    },
    encryptedContent: {
      ciphertext: { type: String, default: '' },
      iv: { type: String, default: '' },
      encryptedKey: { type: String, default: '' },
    },
    // === VANISHING MESSAGES (Feature 6) ===
    expiresAt: {
      type: Date,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    delivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for faster queries
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, receiver: 1 });
MessageSchema.index({ content: 'text' }); // For text search
// TTL index for vanishing messages
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Message', MessageSchema);
