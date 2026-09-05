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
} = require('../controllers/messageController');

// All routes require authentication
router.use(protect);

// Search
router.get('/search', searchMessages);

// Messages
router.get('/:chatId', getMessages);
router.post('/', sendMessage);
router.post('/file', messageFileUpload.single('file'), sendFileMessage);
router.put('/read/:chatId', markAsRead);
router.put('/:id', editMessage);
router.delete('/:id', deleteMessage);

module.exports = router;
