const express = require('express');
const router = express.Router();
const classroomController = require('../controllers/classroomController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, classroomController.listClasses);
router.get('/create', authenticate, (req, res) => res.render('classroom/create', { user: req.user }));
router.get('/join', authenticate, classroomController.showJoin);
router.get('/:id', authenticate, classroomController.getClass);

router.post('/create', authenticate, classroomController.createClass);
router.post('/join', authenticate, classroomController.joinClass);
router.post('/:id/add-student', authenticate, classroomController.addStudent);
router.post('/:id/remove-student', authenticate, classroomController.removeStudent);

module.exports = router;
