const express = require('express');
const router = express.Router();
const breakoutController = require('../controllers/breakoutController');
const { authenticateAPI } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateAPI);

// Create breakout rooms
router.post('/meeting/:meetingId/breakout', breakoutController.createBreakoutRooms);

// Join a breakout room
router.post('/meeting/:meetingId/breakout/:roomId/join', breakoutController.joinBreakoutRoom);

// Leave breakout room and return to main meeting
router.post('/meeting/:meetingId/breakout/leave', breakoutController.leaveBreakoutRoom);

module.exports = router;
