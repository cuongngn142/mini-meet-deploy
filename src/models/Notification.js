/**
 * Notification Model
 * Quản lý thông báo cho người dùng
 * Bao gồm thông báo về lớp học, bài tập, quiz, forum và meeting
 */
const mongoose = require('mongoose');

// Schema định nghĩa thông báo
const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['upcoming-class', 'homework-deadline', 'new-material', 'quiz-available', 'forum-reply', 'homework-graded', 'meeting-reminder'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: String,
  link: String,
  isRead: {
    type: Boolean,
    default: false
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);

