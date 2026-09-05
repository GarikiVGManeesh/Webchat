const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  signup,
  login,
  sendOTP,
  verifyOTP,
  sendPrivacyPinOTP,
  verifyPrivacyPinOTP,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  getMe,
  updatePassword,
  logout,
  logoutAllDevices,
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

// Validation rules
const signupValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Public routes
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Private routes
router.post('/send-pin-reset-otp', protect, sendPrivacyPinOTP);
router.post('/verify-pin-reset-otp', protect, verifyPrivacyPinOTP);
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);
router.get('/logout', protect, logout);
router.get('/logout-all', protect, logoutAllDevices);

module.exports = router;
