/**
 * Material Model
 * Quản lý tài liệu học tập
 * Bao gồm file PDF, PPT, video và document khác
 */
const mongoose = require('mongoose');

// Schema định nghĩa tài liệu
const materialSchema = new mongoose.Schema({
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
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'ppt', 'video', 'document', 'other'],
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileName: String,
  fileSize: Number,
  mimeType: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Material', materialSchema);
