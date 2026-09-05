const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  mobile: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['login', 'verify_mobile', 'reset_password', 'privacy_pin_reset'],
    default: 'login',
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // TTL index: auto-delete after 10 minutes
  },
});

// Generate a random OTP
OTPSchema.statics.generateOTP = function () {
  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
};

// Check if OTP is expired
OTPSchema.methods.isExpired = function () {
  return Date.now() > this.expiresAt;
};

module.exports = mongoose.model('OTP', OTPSchema);
