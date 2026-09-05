const jwt = require('jsonwebtoken');

/**
 * Generate JWT token and set it as an HTTP-only cookie
 * @param {Object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {Object} additionalData - Any additional data to send
 */
const sendTokenResponse = (user, statusCode, res, message = 'Success', additionalData = {}) => {
  const token = user.signJwtToken();

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  };

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    message,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      lastSeen: user.lastSeen,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      createdAt: user.createdAt,
    },
    ...additionalData,
  });
};

module.exports = { sendTokenResponse };
