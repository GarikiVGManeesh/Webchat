const crypto = require('crypto');

/**
 * Generate a unique file name for uploads
 */
const generateFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = originalName.split('.').pop();
  return `${timestamp}_${randomString}.${extension}`;
};

/**
 * Sanitize user object (remove sensitive data)
 */
const sanitizeUser = (user) => {
  return {
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
  };
};

/**
 * Get file type category from MIME type
 */
const getFileTypeCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
};

/**
 * Format file size to human readable format
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get pagination parameters
 */
const getPaginationParams = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 50;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  generateFileName,
  sanitizeUser,
  getFileTypeCategory,
  formatFileSize,
  getPaginationParams,
};
