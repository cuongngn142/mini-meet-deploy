const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');
const { authenticateAPI } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateAPI);

// Ask a question in a meeting
router.post('/meeting/:meetingId/question', qaController.askQuestion);

// Answer a question
router.post('/question/:questionId/answer', qaController.answerQuestion);

// Upvote/downvote a question (toggle)
router.post('/question/:questionId/upvote', qaController.upvoteQuestion);

// Get all questions for a meeting
router.get('/meeting/:meetingId/questions', qaController.getQuestions);

module.exports = router;
