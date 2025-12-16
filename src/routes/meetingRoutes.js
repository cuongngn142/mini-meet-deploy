const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, meetingController.listMeetings);
router.get('/create', authenticate, (req, res) => res.render('meeting/create', { user: req.user, classId: req.query.classId || null }));
router.get('/join', authenticate, meetingController.showJoin);
router.get('/:id', authenticate, meetingController.getMeeting);
router.get('/link/:link', authenticate, meetingController.joinByLink);

router.post('/create', authenticate, meetingController.createMeeting);
router.post('/join', authenticate, meetingController.joinByCode);
router.post('/:id/lock', authenticate, meetingController.lockMeeting);
router.post('/:id/approve', authenticate, meetingController.approveParticipant);
router.post('/:id/deny', authenticate, meetingController.denyParticipant);
router.post('/:id/end', authenticate, meetingController.endMeeting);

module.exports = router;
