/**
 * Upload Middleware — Multer config with disk storage and size limits
 * Files stored at UPLOADS_PATH (/var/data/ourspace/uploads/)
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_PATH = process.env.UPLOADS_PATH || '/var/data/ourspace/uploads';

// File size limits in bytes
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,   // 10MB
  video: 50 * 1024 * 1024,   // 50MB
  audio: 20 * 1024 * 1024    // 20MB
};

// MIME type to media type mapping
const MIME_MAP = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/wave': 'audio',
  'audio/x-wav': 'audio',
  'audio/webm': 'audio',
  'audio/ogg': 'audio'
};

function getMediaType(mimetype) {
  return MIME_MAP[mimetype] || null;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${Date.now()}-${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const mediaType = getMediaType(file.mimetype);
  if (!mediaType) {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    return;
  }
  // Store media type on the file object for later use
  file.mediaType = mediaType;
  cb(null, true);
};

// Create multer instance with max file size (use the largest limit; per-file checks done in route)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (video), per-type checked in route
    files: 10 // Max 10 files per request
  }
});

// Middleware to check individual file sizes after upload
function validateFileSizes(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const fs = require('fs');
  for (const file of req.files) {
    const mediaType = getMediaType(file.mimetype);
    const limit = SIZE_LIMITS[mediaType];
    
    if (file.size > limit) {
      // Delete the oversized file
      try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
      
      const limitMB = Math.round(limit / (1024 * 1024));
      const fileMB = (file.size / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        error: `File "${file.originalname}" (${fileMB}MB) exceeds the ${limitMB}MB limit for ${mediaType} files`
      });
    }
  }
  next();
}

module.exports = { upload, validateFileSizes, getMediaType, SIZE_LIMITS };
