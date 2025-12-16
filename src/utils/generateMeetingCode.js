/**
 * Generate Meeting Code & Link
 * Tạo mã meeting ngẫu nhiên (6 ký tự) và link unique cho cuộc họp
 */

// Tạo mã meeting 6 ký tự hoa (ví dụ: ABC123)
const generateMeetingCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Tạo link meeting dạng chuỗi ngẫu nhiên dài
const generateMeetingLink = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

module.exports = { generateMeetingCode, generateMeetingLink };
