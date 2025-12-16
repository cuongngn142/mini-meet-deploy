/**
 * Meeting Model
 * Quản lý cuộc họp trực tuyến (video conference)
 * Bao gồm host, participants, settings, và trạng thái meeting
 */
const mongoose = require('mongoose');

// Schema định nghĩa thông tin cuộc họp
const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coHosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  meetingCode: {
    type: String,
    unique: true,
    required: true
  },
  meetingLink: {
    type: String,
    unique: true,
    required: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  pendingParticipants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    isMuted: {
      type: Boolean,
      default: false
    },
    cameraEnabled: {
      type: Boolean,
      default: false
    },
    microphoneEnabled: {
      type: Boolean,
      default: false
    }
  }],
  settings: {
    chatEnabled: {
      type: Boolean,
      default: true
    },
    screenShareEnabled: {
      type: Boolean,
      default: true
    },
    recordingEnabled: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  recording: {
    type: String,
    default: null
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Meeting', meetingSchema);
