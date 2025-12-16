/**
 * Homework Model
 * Quản lý bài tập về nhà
 * Bao gồm đề bài, file đính kèm, bài nộp của học sinh và chấm điểm
 */
const mongoose = require('mongoose');

// Schema định nghĩa bài tập
const homeworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String
  }],
  submissions: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    files: [{
      filename: String,
      path: String,
      mimetype: String
    }],
    submittedAt: {
      type: Date,
      default: Date.now
    },
    grade: Number,
    feedback: String,
    reviewedAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Homework', homeworkSchema);
