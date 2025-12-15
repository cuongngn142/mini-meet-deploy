/**
 * Generate JWT Token
 * Tạo JWT token cho user authentication với thời gian hết hạn (default 7 ngày)
 */
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret-key', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

module.exports = generateToken;

