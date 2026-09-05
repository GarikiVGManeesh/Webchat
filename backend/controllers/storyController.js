const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Story = require('../models/Story');
const StoryReport = require('../models/StoryReport');
const User = require('../models/User');
const { getIO } = require('../config/socket');

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Notify a story author's friends that their feed changed so clients with the
 * Stories page open can refresh live. Emitting extra sockets is harmless —
 * each client re-fetches and applies its own block/mute filters.
 */
const emitStoryUpdate = async (authorId) => {
  try {
    const io = getIO();
    if (!io) return;
    const friends = await User.find({ friends: authorId }).select('_id');
    friends.forEach((f) => io.to(f._id.toString()).emit('story:updated', { userId: authorId }));
  } catch (error) {
    console.error('Failed to emit story update:', error.message);
  }
};

/**
 * @desc    Create a new story (media or text)
 * @route   POST /api/stories
 * @access  Private
 */
exports.createStory = async (req, res, next) => {
  try {
    const { content, storyType, backgroundColor } = req.body;

    // Sanitize + validate text stories
    let storyData = {
      user: req.user._id,
      storyType: 'text',
      content: '',
      backgroundColor: HEX_COLOR.test(backgroundColor || '') ? backgroundColor : '#7C3AED',
    };

    if (req.file) {
      // Media story — a file must actually be present and must be image/video
      // (enforced by the storyUpload middleware whitelist).
      const mime = req.file.mimetype || '';
      storyData.storyType = mime.startsWith('video/') ? 'video' : 'image';
      storyData.content = '';
      storyData.media = {
        url: req.file.path,
        publicId: req.file.filename || '',
        mimeType: mime,
      };
    } else {
      // Text story
      const text = typeof content === 'string' ? content.trim() : '';
      if (!text) {
        return res.status(400).json({ success: false, message: 'Story content is required.' });
      }
      storyData.storyType = storyType === 'image' || storyType === 'video' ? storyType : 'text';
      storyData.content = text.slice(0, 300);
      // Reject bogus media requests without a file
      if (storyData.storyType !== 'text') {
        return res.status(400).json({ success: false, message: 'Media file is required.' });
      }
    }

    const story = await Story.create(storyData);
    const populated = await Story.findById(story._id).populate('user', 'name avatar username');

    // Let friends with an open Stories view refresh live.
    emitStoryUpdate(req.user._id);

    res.status(201).json({
      success: true,
      story: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get active stories from friends + the current user's own stories
 * @route   GET /api/stories
 * @access  Private
 */
exports.getStories = async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).select('friends blockedUsers mutedStoryUsers');

    const friendIds = (me?.friends || []).map((id) => id.toString());
    const myBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));
    const myMuted = new Set((me?.mutedStoryUsers || []).map((id) => id.toString()));

    // Users who blocked me are excluded from my feed (and each side enforces
    // this the same way, so my stories never reach people who blocked me).
    const usersWhoBlockedMe = await User.find(
      { blockedUsers: req.user._id },
      { _id: 1 }
    );
    const blockedMe = new Set(usersWhoBlockedMe.map((u) => u._id.toString()));

    // Visible authors = friends, minus anyone blocked or story-muted in either
    // direction. The current user is always included (returned as myStories).
    const visibleFriendIds = friendIds.filter(
      (id) => !myBlocked.has(id) && !blockedMe.has(id) && !myMuted.has(id)
    );

    const visibleUserIds = [req.user._id.toString(), ...visibleFriendIds];

    const stories = await Story.find({
      // Backend-enforced 24h expiry — expired stories are never returned.
      expiresAt: { $gt: new Date() },
      user: { $in: visibleUserIds },
    })
      .populate('user', 'name avatar username')
      .sort({ createdAt: -1 });

    // Group stories by user
    const grouped = {};
    stories.forEach((story) => {
      const userId = story.user._id.toString();
      if (!grouped[userId]) {
        grouped[userId] = {
          user: story.user,
          stories: [],
          hasUnviewed: false,
        };
      }
      grouped[userId].stories.push(story);
      const viewed = story.viewers.some(
        (v) => v.user.toString() === req.user._id.toString()
      );
      if (!viewed) grouped[userId].hasUnviewed = true;
    });

    // Current user's stories first (their own section)
    const myStories = grouped[req.user._id.toString()] || null;
    delete grouped[req.user._id.toString()];

    const otherStories = Object.values(grouped).sort((a, b) => {
      // Unviewed first, then by most recent story
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      const aLatest = new Date(a.stories[0]?.createdAt || 0);
      const bLatest = new Date(b.stories[0]?.createdAt || 0);
      return bLatest - aLatest;
    });

    res.status(200).json({
      success: true,
      myStories,
      stories: otherStories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    View a story (add to viewers)
 * @route   PUT /api/stories/:id/view
 * @access  Private
 */
exports.viewStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story || story.expiresAt <= new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Only the author (viewing their own story) or a friend who isn't blocked
    // in either direction may view a story.
    if (story.user.toString() !== req.user._id.toString()) {
      const [viewer, author] = await Promise.all([
        User.findById(req.user._id).select('friends blockedUsers'),
        User.findById(story.user).select('blockedUsers'),
      ]);

      const authorId = story.user.toString();
      const blockedByAuthor = author?.blockedUsers?.some(
        (id) => id.toString() === req.user._id.toString()
      );
      const hasBlockedAuthor = viewer?.blockedUsers?.some(
        (id) => id.toString() === authorId
      );
      const isFriend = viewer?.friends?.some(
        (id) => id.toString() === authorId
      );

      if (!isFriend || blockedByAuthor || hasBlockedAuthor) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this story',
        });
      }
    }

    const alreadyViewed = story.viewers.some(
      (v) => v.user.toString() === req.user._id.toString()
    );

    if (!alreadyViewed) {
      story.viewers.push({ user: req.user._id, viewedAt: new Date() });
      await story.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get the list of viewers for a story (owner only)
 * @route   GET /api/stories/:id/viewers
 * @access  Private
 */
exports.getStoryViewers = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story || story.expiresAt <= new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the story owner can view the viewer list',
      });
    }

    // Sort viewers newest-first
    const viewers = [...story.viewers].sort(
      (a, b) => new Date(b.viewedAt) - new Date(a.viewedAt)
    );

    // Resolve viewer user documents (avoids populating embedded subdocs)
    const viewerIds = viewers.map((v) => v.user);
    const users = await User.find({ _id: { $in: viewerIds } }).select('name avatar username');
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    res.status(200).json({
      success: true,
      count: viewers.length,
      viewers: viewers.map((v) => ({
        user: userMap.get(v.user.toString()) || { _id: v.user },
        viewedAt: v.viewedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a story (owner only). Also removes the media from Cloudinary.
 * @route   DELETE /api/stories/:id
 * @access  Private
 */
exports.deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Ownership enforced server-side — a normal user can NEVER delete someone
    // else's story.
    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Remove the uploaded media from Cloudinary when it exists
    if (story.media && story.media.publicId) {
      try {
        const isVideo = (story.media.mimeType || '').startsWith('video/');
        await cloudinary.uploader.destroy(story.media.publicId, {
          resource_type: isVideo ? 'video' : 'image',
        });
      } catch (cloudError) {
        console.error('Failed to delete story media from Cloudinary:', cloudError.message);
      }
    }

    await story.deleteOne();

    // Let friends with an open Stories view refresh live.
    emitStoryUpdate(req.user._id);

    res.status(200).json({ success: true, message: 'Story deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mute a user's stories so they disappear from the feed
 * @route   POST /api/stories/mute/:userId
 * @access  Private
 */
exports.muteUserStories = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user' });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot mute yourself' });
    }

    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!req.user.mutedStoryUsers.some((id) => id.toString() === userId)) {
      req.user.mutedStoryUsers.push(userId);
      await req.user.save();
    }

    res.status(200).json({ success: true, message: 'Stories muted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unmute a user's stories
 * @route   DELETE /api/stories/mute/:userId
 * @access  Private
 */
exports.unmuteUserStories = async (req, res, next) => {
  try {
    const { userId } = req.params;

    req.user.mutedStoryUsers = (req.user.mutedStoryUsers || []).filter(
      (id) => id.toString() !== userId
    );
    await req.user.save();

    res.status(200).json({ success: true, message: 'Stories unmuted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List users whose stories the current user has muted
 * @route   GET /api/stories/muted
 * @access  Private
 */
exports.getMutedStoriesUsers = async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).populate({
      path: 'mutedStoryUsers',
      select: 'name avatar username',
    });

    res.status(200).json({
      success: true,
      users: me?.mutedStoryUsers || [],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Report a story
 * @route   POST /api/stories/:id/report
 * @access  Private
 */
exports.reportStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story || story.expiresAt <= new Date()) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    if (story.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot report your own story' });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';

    await StoryReport.updateOne(
      { story: story._id, reporter: req.user._id },
      {
        $set: {
          story: story._id,
          author: story.user,
          reporter: req.user._id,
          reason,
          status: 'open',
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    res.status(200).json({ success: true, message: 'Story reported' });
  } catch (error) {
    next(error);
  }
};
