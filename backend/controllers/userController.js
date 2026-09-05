const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

const normalizeUsername = (value) => {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);

  return cleaned.length >= 3 ? cleaned : '';
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasId = (ids, id) => ids.some((item) => item.toString() === id.toString());

/**
 * @desc    Get all users (for searching/starting new chats)
 * @route   GET /api/users
 * @access  Private
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const requester = await User.findById(req.user._id)
      .select('friends sentFriendRequests receivedFriendRequests');

    const friends = new Set((requester?.friends || []).map((id) => id.toString()));
    const sentRequests = new Set((requester?.sentFriendRequests || []).map((id) => id.toString()));
    const receivedRequests = new Set((requester?.receivedFriendRequests || []).map((id) => id.toString()));

    const query = {
      _id: { $ne: req.user._id },
    };

    let normalizedSearch = '';
    let handleSearch = '';

    if (search) {
      normalizedSearch = search.trim().slice(0, 50);
      handleSearch = normalizedSearch.replace(/^@/, '').trim();
      const safeSearch = escapeRegex(normalizedSearch);
      const safeHandleSearch = escapeRegex(handleSearch || normalizedSearch);
      query.$or = [
        { username: { $regex: safeHandleSearch, $options: 'i' } },
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('name email avatar status lastSeen bio username')
      .limit(50);

    const normalizedHandle = (handleSearch || normalizedSearch).toLowerCase();
    users.sort((a, b) => {
      const rank = (value) => value === normalizedHandle ? 0 : value.startsWith(normalizedHandle) ? 1 : 2;
      return rank(a.username || '') - rank(b.username || '') || a.name.localeCompare(b.name);
    });

    const usersWithRelation = users.map((user) => ({
      ...user.toObject(),
      relationship: friends.has(user._id.toString())
        ? 'friends'
        : sentRequests.has(user._id.toString())
          ? 'sent'
          : receivedRequests.has(user._id.toString())
            ? 'received'
            : 'none',
    }));

    res.status(200).json({
      success: true,
      count: usersWithRelation.length,
      users: usersWithRelation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name email avatar status lastSeen bio mobile createdAt username friends sentFriendRequests receivedFriendRequests');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio, username, profilePrivacy, mobile } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (profilePrivacy !== undefined) {
      if (!['public', 'friends', 'private'].includes(profilePrivacy)) {
        return res.status(400).json({ success: false, message: 'Profile privacy must be public, friends, or private.' });
      }
      updateData.profilePrivacy = profilePrivacy;
    }

    if (mobile !== undefined) updateData.mobile = mobile;
    if (username !== undefined) {
      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username must be 3-20 characters with letters, numbers, dot, or underscore.',
        });
      }

      const existingUser = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'This username is already taken. Please choose another one.',
        });
      }

      updateData.username = normalizedUsername;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update avatar
 * @route   PUT /api/users/avatar
 * @access  Private
 */
exports.updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image.',
      });
    }

    const user = await User.findById(req.user._id);

    // Delete old avatar from Cloudinary
    if (user.avatarPublicId) {
      await cloudinary.uploader.destroy(user.avatarPublicId);
    }

    // Update with new avatar
    user.avatar = req.file.path;
    user.avatarPublicId = req.file.filename;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully.',
      user: {
        avatar: user.avatar,
        avatarPublicId: user.avatarPublicId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove avatar
 * @route   DELETE /api/users/avatar
 * @access  Private
 */
exports.removeAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.avatarPublicId) {
      await cloudinary.uploader.destroy(user.avatarPublicId);
    }

    user.avatar = '';
    user.avatarPublicId = '';
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Avatar removed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Block a user
 * @route   PUT /api/users/block/:id
 * @access  Private
 */
exports.blockUser = async (req, res, next) => {
  try {
    const userToBlock = await User.findById(req.params.id);

    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already blocked
    if (hasId(user.blockedUsers, req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked.',
      });
    }

    user.blockedUsers.push(req.params.id);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'User blocked successfully.',
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unblock a user
 * @route   PUT /api/users/unblock/:id
 * @access  Private
 */
exports.unblockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    // Check if user is in blocked list
    const index = user.blockedUsers.indexOf(req.params.id);
    if (index === -1) {
      return res.status(400).json({
        success: false,
        message: 'User is not blocked.',
      });
    }

    user.blockedUsers.splice(index, 1);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully.',
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get blocked users list
 * @route   GET /api/users/blocked
 * @access  Private
 */
exports.getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'blockedUsers',
      select: 'name email avatar',
    });

    res.status(200).json({
      success: true,
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pending friend requests
 * @route   GET /api/users/requests
 * @access  Private
 */
exports.getFriendRequests = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('sentFriendRequests', 'name email avatar username')
      .populate('receivedFriendRequests', 'name email avatar username');

    res.status(200).json({
      success: true,
      sentRequests: user.sentFriendRequests,
      receivedRequests: user.receivedFriendRequests,
    });
  } catch (error) {
    next(error);
  }
};

exports.getFriends = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'friends',
      'name avatar username status lastSeen bio'
    );
    res.status(200).json({ success: true, friends: user.friends });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a friend request
 * @route   POST /api/users/friend-request/:id
 * @access  Private
 */
exports.sendFriendRequest = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself.',
      });
    }

    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findById(targetId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (hasId(currentUser.friends, targetId) || hasId(targetUser.friends, req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already friends with this user.',
      });
    }

    if (hasId(currentUser.sentFriendRequests, targetId)) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent.',
      });
    }

    if (hasId(currentUser.receivedFriendRequests, targetId)) {
      return res.status(400).json({
        success: false,
        message: 'This person already sent you a request. Accept it from the friend request box.',
      });
    }

    currentUser.sentFriendRequests.push(targetId);
    targetUser.receivedFriendRequests.push(req.user._id);
    await currentUser.save({ validateBeforeSave: false });
    await targetUser.save({ validateBeforeSave: false });

    req.app.get('io')?.to(targetId).emit('friend:updated');
    req.app.get('io')?.to(req.user._id.toString()).emit('friend:updated');

    res.status(200).json({
      success: true,
      message: 'Friend request sent successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept a friend request
 * @route   PUT /api/users/friend-request/:id/accept
 * @access  Private
 */
exports.acceptFriendRequest = async (req, res, next) => {
  try {
    const requesterId = req.params.id;
    const currentUser = await User.findById(req.user._id);
    const requester = await User.findById(requesterId);

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!hasId(currentUser.receivedFriendRequests, requesterId)) {
      return res.status(400).json({
        success: false,
        message: 'No pending request from this user.',
      });
    }

    currentUser.receivedFriendRequests = currentUser.receivedFriendRequests.filter((id) => id.toString() !== requesterId);
    requester.sentFriendRequests = requester.sentFriendRequests.filter((id) => id.toString() !== req.user._id.toString());

    if (!hasId(currentUser.friends, requesterId)) {
      currentUser.friends.push(requesterId);
    }
    if (!hasId(requester.friends, req.user._id)) {
      requester.friends.push(req.user._id);
    }

    await currentUser.save({ validateBeforeSave: false });
    await requester.save({ validateBeforeSave: false });

    req.app.get('io')?.to(requesterId).emit('friend:updated');
    req.app.get('io')?.to(req.user._id.toString()).emit('friend:updated');

    res.status(200).json({
      success: true,
      message: 'Friend request accepted.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a friend request
 * @route   PUT /api/users/friend-request/:id/reject
 * @access  Private
 */
exports.rejectFriendRequest = async (req, res, next) => {
  try {
    const requesterId = req.params.id;
    const currentUser = await User.findById(req.user._id);
    const requester = await User.findById(requesterId);

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    currentUser.receivedFriendRequests = currentUser.receivedFriendRequests.filter((id) => id.toString() !== requesterId);
    requester.sentFriendRequests = requester.sentFriendRequests.filter((id) => id.toString() !== req.user._id.toString());

    await currentUser.save({ validateBeforeSave: false });
    await requester.save({ validateBeforeSave: false });

    req.app.get('io')?.to(requesterId).emit('friend:updated');
    req.app.get('io')?.to(req.user._id.toString()).emit('friend:updated');

    res.status(200).json({
      success: true,
      message: 'Friend request rejected.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update status
 * @route   PUT /api/users/status
 * @access  Private
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: online, offline, away, busy.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { status, lastSeen: Date.now() },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      status: user.status,
      lastSeen: user.lastSeen,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user's public key for E2E encryption
 * @route   PUT /api/users/public-key
 * @access  Private
 */
exports.updatePublicKey = async (req, res, next) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({ success: false, message: 'Public key is required.' });
    }

    await User.findByIdAndUpdate(req.user._id, { publicKey });

    res.status(200).json({
      success: true,
      message: 'Public key updated.',
    });
  } catch (error) {
    next(error);
  }
};
