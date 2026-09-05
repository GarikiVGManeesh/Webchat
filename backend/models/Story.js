const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    media: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      mimeType: { type: String, default: '' },
    },
    storyType: {
      type: String,
      enum: ['text', 'image', 'video'],
      default: 'text',
    },
    backgroundColor: {
      type: String,
      default: '#7C3AED',
    },
    viewers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    // TTL: auto-delete after 24 hours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index
StorySchema.index({ user: 1, createdAt: -1 });
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Story', StorySchema);
