const mongoose = require('mongoose');

const StoryReportSchema = new mongoose.Schema(
  {
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
      required: true,
    },
    // Owner of the reported story (denormalized for easy moderation queries)
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [300, 'Reason cannot exceed 300 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'reviewed', 'dismissed'],
      default: 'open',
    },
  },
  {
    timestamps: true,
  }
);

// One report per story per user (a user cannot spam the same story)
StoryReportSchema.index({ story: 1, reporter: 1 }, { unique: true });
StoryReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('StoryReport', StoryReportSchema);
