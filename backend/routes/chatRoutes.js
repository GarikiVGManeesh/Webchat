const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { messageFileUpload, groupAvatarUpload } = require('../middlewares/upload');
const {
  getChats,
  getChatById,
  createChat,
  pinChat,
  archiveChat,
  deleteChat,
  toggleChatLock,
  toggleChatMute,
  getNotificationSettings,
  updateNotificationSettings,
  clearChat,
  createGroupChat,
  addGroupMember,
  removeGroupMember,
  updateGroup,
  leaveGroup,
  promoteMember,
  demoteMember,
  updateVanishMode,
} = require('../controllers/chatController');

// All routes require authentication
router.use(protect);

router.get('/', getChats);
router.post('/', createChat);
// Custom notification settings (declared before /:id)
router.get('/:id/notification-settings', getNotificationSettings);
router.put('/:id/notification-settings', updateNotificationSettings);
router.get('/:id', getChatById);
router.put('/pin/:id', pinChat);
router.put('/archive/:id', archiveChat);
router.put('/lock/:id', toggleChatLock);
router.put('/mute/:id', toggleChatMute);
router.delete('/:id/clear', clearChat);
router.delete('/:id', deleteChat);

// Group chat routes
// Note: both 'avatar' and 'groupAvatar' field names are accepted for the
// upload so the existing client keeps working unchanged.
router.post('/group', groupAvatarUpload.single('groupAvatar'), createGroupChat);
router.put('/group/:id/add', addGroupMember);
router.put('/group/:id/remove', removeGroupMember);
router.put('/group/:id/update', groupAvatarUpload.single('groupAvatar'), updateGroup);
router.put('/group/:id/leave', leaveGroup);
router.put('/group/:id/promote', promoteMember);
router.put('/group/:id/demote', demoteMember);

// Vanish mode
router.put('/:id/vanish', updateVanishMode);

module.exports = router;
