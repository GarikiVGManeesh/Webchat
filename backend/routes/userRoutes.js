const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { avatarUpload } = require('../middlewares/upload');
const {
  getUsers,
  getUserById,
  updateProfile,
  updateAvatar,
  removeAvatar,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateStatus,
  getFriendRequests,
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  updatePublicKey,
} = require('../controllers/userController');

// All routes require authentication
router.use(protect);

// User management
router.get('/', getUsers);
router.get('/blocked', getBlockedUsers);
router.get('/requests', getFriendRequests);
router.get('/friends', getFriends);
router.post('/friend-request/:id', sendFriendRequest);
router.put('/friend-request/:id/accept', acceptFriendRequest);
router.put('/friend-request/:id/reject', rejectFriendRequest);
router.get('/:id', getUserById);

// Profile
router.put('/profile', updateProfile);
router.put('/avatar', avatarUpload.single('avatar'), updateAvatar);
router.delete('/avatar', removeAvatar);
router.put('/status', updateStatus);

// E2E Encryption public key
router.put('/public-key', updatePublicKey);

// Block/Unblock
router.put('/block/:id', blockUser);
router.put('/unblock/:id', unblockUser);

module.exports = router;
