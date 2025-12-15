const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, forumController.listPosts);
router.get('/create', authenticate, (req, res) => res.render('forum/create', { user: req.user }));
router.get('/:id', authenticate, forumController.getPost);

router.post('/create', authenticate, forumController.createPost);
router.post('/:id/comment', authenticate, forumController.addComment);
router.post('/:id/like', authenticate, forumController.likePost);

module.exports = router;
