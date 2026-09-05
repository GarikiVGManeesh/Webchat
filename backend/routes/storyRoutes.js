const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { messageFileUpload } = require('../middlewares/upload');
const {
  createStory,
  getStories,
  viewStory,
  deleteStory,
} = require('../controllers/storyController');

// All routes require authentication
router.use(protect);

router.get('/', getStories);
router.post('/', messageFileUpload.single('media'), createStory);
router.put('/:id/view', viewStory);
router.delete('/:id', deleteStory);

module.exports = router;
