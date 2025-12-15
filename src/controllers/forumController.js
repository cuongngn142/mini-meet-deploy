const Forum = require('../models/Forum');

const createPost = async (req, res) => {
  try {
    const { title, content, classId, lesson, tags } = req.body;
    
    const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];

    const post = await Forum.create({
      title,
      content,
      author: req.user._id,
      class: classId || null,
      lesson,
      tags: tagsArray
    });

    res.redirect(`/forum/${post._id}`);
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const getPost = async (req, res) => {
  try {
    const post = await Forum.findById(req.params.id)
      .populate('author', 'name email avatar')
      .populate('comments.author', 'name email avatar')
      .populate('class', 'name code');

    if (!post) {
      return res.render('error', {
        error: 'Post not found',
        user: req.user
      });
    }

    res.render('forum/view', {
      post,
      user: req.user
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const listPosts = async (req, res) => {
  try {
    const { classId, lesson } = req.query;
    const query = {};
    
    if (classId) query.class = classId;
    if (lesson) query.lesson = lesson;

    const posts = await Forum.find(query)
      .populate('author', 'name email')
      .populate('class', 'name')
      .sort({ createdAt: -1 });

    res.render('forum/list', {
      posts,
      user: req.user,
      filters: { classId, lesson }
    });
  } catch (error) {
    res.render('error', {
      error: error.message,
      user: req.user
    });
  }
};

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Forum.findById(req.params.id);

    post.comments.push({
      author: req.user._id,
      content
    });
    await post.save();

    res.redirect(`/forum/${post._id}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const likePost = async (req, res) => {
  try {
    const post = await Forum.findById(req.params.id);
    const index = post.likes.findIndex(l => l.toString() === req.user._id.toString());
    
    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(req.user._id);
    }
    await post.save();

    res.json({ likes: post.likes.length, liked: index === -1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPost,
  getPost,
  listPosts,
  addComment,
  likePost
}