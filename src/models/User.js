/**
 * User Model
 * Quản lý thông tin người dùng (admin, giáo viên, học sinh)
 * Bao gồm authentication, profile, và liên kết với các lớp học
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Schema định nghĩa cấu trúc dữ liệu User
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    default: 'student'
  },
  avatar: {
    type: String,
    default: ''
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware: tự động hash password trước khi lưu vào database
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method: so sánh password nhập vào với password đã hash trong database
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

