/**
 * Quiz Model
 * Quản lý bài kiểm tra trắc nghiệm
 * Bao gồm câu hỏi, đáp án, thời gian làm bài và kết quả học sinh
 */
const mongoose = require('mongoose');

// Schema định nghĩa bài quiz
const quizSchema = new mongoose.Schema({
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
  questions: [{
    question: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['multiple-choice', 'true-false', 'short-answer'],
      default: 'multiple-choice'
    },
    options: [String],
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    points: {
      type: Number,
      default: 1
    }
  }],
  timeLimit: Number,
  startDate: Date,
  endDate: Date,
  attempts: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    answers: [{
      questionId: mongoose.Schema.Types.ObjectId,
      answer: mongoose.Schema.Types.Mixed
    }],
    score: Number,
    submittedAt: {
      type: Date,
      default: Date.now
    },
    suspiciousActivities: [{
      type: String,
      timestamp: Date
    }]
  }],
  antiCheatEnabled: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Quiz', quizSchema);
