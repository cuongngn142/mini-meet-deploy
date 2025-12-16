const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticate } = require('../middleware/auth');
const Class = require('../models/Class');

router.get('/', authenticate, quizController.listQuizzes);
router.get('/create', authenticate, async (req, res) => {
    const classes = await Class.find({ teacher: req.user._id });
    res.render('quiz/create', { user: req.user, classes });
});
router.get('/:id', authenticate, quizController.getQuiz);

router.post('/create', authenticate, quizController.createQuiz);
router.post('/:id/submit', authenticate, quizController.submitQuiz);

module.exports = router;
