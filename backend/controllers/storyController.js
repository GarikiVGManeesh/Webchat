const Story = require('../models/Story');
const User = require('../models/User');

/**
 * @desc    Create a new story
 * @route   POST /api/stories
 * @access  Private
 */
exports.createStory = async (req, res, next) => {
  try {
    const { content, storyType, backgroundColor } = req.body;

    const storyData = {
      user: req.user._id,
      storyType: storyType || 'text',
      content: content || '',
      backgroundColor: backgroundColor || '#7C3AED',
    };

    // If file uploaded (image/video)
    if (req.file) {
      storyData.media = {
        url: req.file.path,
        publicId: req.file.filename || '',
        mimeType: req.file.mimetype || '',
      };
      if (req.file.mimetype?.startsWith('video/')) {
        storyData.storyType = 'video';
      } else {
        storyData.storyType = 'image';
      }
    }

    const story = await Story.create(storyData);
    const populated = await Story.findById(story._id).populate('user', 'name avatar');

    res.status(201).json({
      success: true,
      story: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get stories from friends only (blocked users excluded both ways)
 * @route   GET /api/stories
 * @access  Private
 */
exports.getStories = async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).select('friends blockedUsers');

    const friendIds = (me?.friends || []).map((id) => id.toString());
    const myBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));

    // Users who blocked me (blocking is one-directional). They are excluded
    // from my feed, and since each side enforces this the same way, my own
    // stories never reach people who blocked me either.
    const usersWhoBlockedMe = await User.find(
      { blockedUsers: req.user._id },
      { _id: 1 }
    );
    const blockedMe = new Set(usersWhoBlockedMe.map((u) => u._id.toString()));

    // Visible authors = friends, minus anyone blocked in either direction.
    const visibleFriendIds = friendIds.filter(
      (id) => !myBlocked.has(id) && !blockedMe.has(id)
    );

    // Always include the current user so their own stories can be returned
    // separately as myStories.
    const visibleUserIds = [req.user._id.toString(), ...visibleFriendIds];

    const stories = await Story.find({
      expiresAt: { $gt: new Date() },
      user: { $in: visibleUserIds },
    })
      .populate('user', 'name avatar')
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
      // Check if current user has viewed this story
      const viewed = story.viewers.some(
        (v) => v.user.toString() === req.user._id.toString()
      );
      if (!viewed) grouped[userId].hasUnviewed = true;
    });

    // Put current user's stories first
    const myStories = grouped[req.user._id.toString()] || null;
    delete grouped[req.user._id.toString()];

    const otherStories = Object.values(grouped).sort(
      (a, b) => (b.hasUnviewed ? 1 : 0) - (a.hasUnviewed ? 1 : 0)
    );

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
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Only the author (marking their own story) or a friend who isn't blocked
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

    // Check if already viewed
    const alreadyViewed = story.viewers.some(
      (v) => v.user.toString() === req.user._id.toString()
    );

    if (!alreadyViewed) {
      story.viewers.push({ user: req.user._id });
      await story.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a story
 * @route   DELETE /api/stories/:id
 * @access  Private
 */
exports.deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await story.deleteOne();
    res.status(200).json({ success: true, message: 'Story deleted' });
  } catch (error) {
    next(error);
  }
};
