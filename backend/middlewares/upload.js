const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Default mime types accepted for generic message/file uploads
const DEFAULT_ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/ogg',
  'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/aac',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
  'text/csv',
  'application/json',
];

/**
 * Create a Multer upload middleware with Cloudinary storage
 */
const createUploadMiddleware = (
  folderName = 'general',
  allowedFormats = null,
  maxSize = 10 * 1024 * 1024,
  options = {}
) => {
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `chatting_app/${folderName}`,
      allowed_formats: allowedFormats || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'm4a', 'aac', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'csv', 'json'],
      resource_type: 'auto',
      // Story uploads skip the generic image transformation so videos are not
      // resized/downscaled; set transformation: null to opt out.
      ...(options.transformation === null
        ? {}
        : {
            transformation: [
              { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
            ],
          }),
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: maxSize,
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = options.allowedMimes || DEFAULT_ALLOWED_MIMES;

      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} is not supported.`), false);
      }
    },
  });
};

/**
 * Avatar upload middleware (images only, max 5MB)
 */
const avatarUpload = createUploadMiddleware('avatars', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5 * 1024 * 1024);

/**
 * Message file upload middleware (all types, max 10MB)
 */
const messageFileUpload = createUploadMiddleware('messages', null, 10 * 1024 * 1024);

/**
 * Story upload middleware — images (JPG/JPEG/PNG/WEBP) and videos
 * (MP4/WEBM/MOV) only, max 60MB. Kept intentionally stricter than message
 * uploads so stories can never carry executable/other file types.
 */
const storyUpload = createUploadMiddleware(
  'stories',
  ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov'],
  60 * 1024 * 1024,
  {
    transformation: null,
    allowedMimes: [
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
    ],
  }
);

module.exports = { avatarUpload, messageFileUpload, storyUpload, createUploadMiddleware };
