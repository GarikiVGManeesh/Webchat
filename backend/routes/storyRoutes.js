const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { storyUpload } = require('../middlewares/upload');
const {
  createStory,
  getStories,
  viewStory,
  getStoryViewers,
  deleteStory,
  muteUserStories,
  unmuteUserStories,
  getMutedStoriesUsers,
  reportStory,
} = require('../controllers/storyController');

// All routes require authentication
router.use(protect);

// Feed + creation
router.get('/', getStories);
router.post('/', storyUpload.single('media'), createStory);

// Story mute management (note: must be declared before /:id routes)
router.post('/mute/:userId', muteUserStories);
router.delete('/mute/:userId', unmuteUserStories);
router.get('/muted', getMutedStoriesUsers);

// Per-story actions
router.put('/:id/view', viewStory);
router.get('/:id/viewers', getStoryViewers);
router.post('/:id/report', reportStory);
router.delete('/:id', deleteStory);

module.exports = router;
