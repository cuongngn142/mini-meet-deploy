const express = require('express');
const router = express.Router();
const homeworkController = require('../controllers/homeworkController');
const { authenticate } = require('../middleware/auth');
const Class = require('../models/Class');

router.get('/', authenticate, homeworkController.listHomework);
router.get('/create', authenticate, async (req, res) => {
    try {
        // Get all classes where user is teacher
        const classes = await Class.find({ teacher: req.user._id }).sort({ createdAt: -1 });
        res.render('homework/create', { user: req.user, classes });
    } catch (error) {
        res.render('error', { error: error.message, user: req.user });
    }
});
router.get('/:id', authenticate, homeworkController.getHomework);

router.post('/create', authenticate, homeworkController.createHomework);
router.post('/:id/attachments', authenticate, homeworkController.uploadAttachment, homeworkController.addAttachments);
router.post('/:id/submit', authenticate, homeworkController.submitHomework, homeworkController.addSubmission);
router.post('/:id/grade', authenticate, homeworkController.gradeHomework);

module.exports = router;
