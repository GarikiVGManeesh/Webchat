const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { messageFileUpload } = require('../middlewares/upload');
const {
  getMessages,
  sendMessage,
  sendFileMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  searchMessages,
  starMessage,
  unstarMessage,
  getStarredMessages,
} = require('../controllers/messageController');

// All routes require authentication
router.use(protect);

// Search + starred messages (declared before /:chatId)
router.get('/search', searchMessages);
router.get('/starred', getStarredMessages);

// Messages
router.get('/:chatId', getMessages);
router.post('/', sendMessage);
router.post('/file', messageFileUpload.single('file'), sendFileMessage);
router.put('/read/:chatId', markAsRead);
router.put('/:id', editMessage);
router.delete('/:id', deleteMessage);

// Star actions
router.put('/:id/star', starMessage);
router.delete('/:id/star', unstarMessage);

module.exports = router;
