/**
 * Auth Controller
 * Xử lý authentication: đăng ký, đăng nhập, đăng xuất
 * Quản lý JWT token và session
 */
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { validationResult } = require('express-validator');

/**
 * Đăng ký tài khoản mới
 * Validate dữ liệu, kiểm tra email tồn tại, tạo user và gửi token
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        error: errors.array()[0].msg,
        user: null
      });
    }

    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/register', {
        error: 'User already exists',
        user: null
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student'
    });

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production'
    });

    res.redirect('/meeting');
  } catch (error) {
    res.render('auth/register', {
      error: error.message,
      user: null
    });
  }
};

/**
 * Đăng nhập vào hệ thống
 * Xác thực email/password và tạo JWT token
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        error: errors.array()[0].msg,
        user: null
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.render('auth/login', {
        error: 'Invalid credentials',
        user: null
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        error: 'Invalid credentials',
        user: null
      });
    }

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production'
    });

    res.redirect('/meeting');
  } catch (error) {
    res.render('auth/login', {
      error: error.message,
      user: null
    });
  }
};

/**
 * Đăng xuất - xóa token cookie
 */
const logout = (req, res) => {
  res.cookie('token', '', { maxAge: 0 });
  res.redirect('/auth/login');
};

const showLogin = (req, res) => {
  res.render('auth/login', { error: null, user: null });
};

const showRegister = (req, res) => {
  res.render('auth/register', { error: null, user: null });
};

const forgotPassword = async (req, res) => {
  res.render('auth/forgot-password', {
    error: null,
    message: null,
    user: null
  });
};

module.exports = {
  register,
  login,
  logout,
  showLogin,
  showRegister,
  forgotPassword
}
