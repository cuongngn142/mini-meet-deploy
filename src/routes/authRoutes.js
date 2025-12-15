/**
 * Auth Routes
 * Định tuyến cho authentication: login, register, logout, forgot password
 * Sử dụng express-validator để validate dữ liệu
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');

// GET routes - hiển thị forms
router.get('/login', optionalAuth, authController.showLogin);
router.get('/register', optionalAuth, authController.showRegister);
router.get('/forgot-password', optionalAuth, authController.forgotPassword);
router.get('/logout', authenticate, authController.logout);

// POST routes - xử lý submit forms với validation
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], authController.register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

module.exports = router;
