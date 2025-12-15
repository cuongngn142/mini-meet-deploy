/**
 * Authentication Middleware
 * Xác thực JWT token từ cookie hoặc Authorization header
 * Cung cấp 3 loại: authenticate (redirect), optionalAuth, authenticateAPI (JSON)
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Middleware: bắt buộc đăng nhập
 * Nếu không có token hoặc token không hợp lệ -> redirect đến login
 */
const authenticate = async (req, res, next) => {
  try {
    // Check for token in cookies or Authorization header
    let token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.redirect('/auth/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.redirect('/auth/login');
    }

    req.user = user;

    // Đếm số thông báo chưa đọc
    const unreadCount = await Notification.countDocuments({
      user: user._id,
      isRead: false
    });
    req.user.unreadNotifications = unreadCount;

    next();
  } catch (error) {
    return res.redirect('/auth/login');
  }
};

/**
 * Middleware: authentication không bắt buộc
 * Set req.user = null nếu không có token, không redirect
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
      const user = await User.findById(decoded.id).select('-password');
      req.user = user || null;
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Middleware: authentication cho API endpoints
 * Trả về JSON error thay vì redirect
 */
const authenticateAPI = async (req, res, next) => {
  try {
    // Check for token in cookies or Authorization header
    let token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate, optionalAuth, authenticateAPI };

