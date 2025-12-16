const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
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
  joinedAt: {
    type: Date,
    required: true
  },
  leftAt: Date,
  duration: Number,
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
