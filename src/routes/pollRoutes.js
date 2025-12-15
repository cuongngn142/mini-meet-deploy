const express = require('express');
const router = express.Router();
const pollController = require('../controllers/pollController');
const { authenticateAPI } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateAPI);

// Create a poll in a meeting
router.post('/meeting/:meetingId/poll', pollController.createPoll);

// Vote on a poll
router.post('/poll/:pollId/vote', pollController.votePoll);

// Get all polls for a meeting
router.get('/meeting/:meetingId/polls', pollController.getPolls);

// End a poll
router.patch('/poll/:pollId/end', pollController.endPoll);

module.exports = router;
