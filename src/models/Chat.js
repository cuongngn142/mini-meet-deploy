/**
 * Chat Model
 * Quản lý tin nhắn trong cuộc họp
 * Bao gồm tin nhắn thường, tin nhắn hệ thống và reaction
 */
const mongoose = require('mongoose');

// Schema định nghĩa tin nhắn chat
const chatSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['message', 'system', 'reaction'],
    default: 'message'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Chat', chatSchema);
