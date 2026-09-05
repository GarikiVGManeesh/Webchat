const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { messageFileUpload } = require('../middlewares/upload');
const {
  getChats,
  getChatById,
  createChat,
  pinChat,
  archiveChat,
  deleteChat,
  createGroupChat,
  addGroupMember,
  removeGroupMember,
  updateGroup,
  leaveGroup,
  updateVanishMode,
} = require('../controllers/chatController');

// All routes require authentication
router.use(protect);

router.get('/', getChats);
router.post('/', createChat);
router.get('/:id', getChatById);
router.put('/pin/:id', pinChat);
router.put('/archive/:id', archiveChat);
router.delete('/:id', deleteChat);

// Group chat routes
router.post('/group', createGroupChat);
router.put('/group/:id/add', addGroupMember);
router.put('/group/:id/remove', removeGroupMember);
router.put('/group/:id/update', messageFileUpload.single('groupAvatar'), updateGroup);
router.put('/group/:id/leave', leaveGroup);

// Vanish mode
router.put('/:id/vanish', updateVanishMode);

module.exports = router;
