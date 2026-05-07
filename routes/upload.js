'use strict';
const express    = require('express');
const multer     = require('multer');
const router     = express.Router();
const cloudinary = require('../config/cloudinary');
const { verifyToken } = require('../middleware/auth');
const logger     = require('../utils/logger');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MBdf

const storage = multer.memoryStorage();
const upload  = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WebP and GIF images are allowed'));
    }
    cb(null, true);
  },
});

// ── POST /api/upload ──────────────────────────────────────────────────────────
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:         'mocha-point-menu',
          resource_type:  'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    logger.info('Image uploaded', { public_id: result.public_id, by: req.user.email });

    return res.json({
      url:       result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    logger.error('Upload error', { err: err.message });
    return res.status(500).json({ error: 'Image upload failed', details: err.message || err });
  }
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' });
  }
  return res.status(400).json({ error: err.message });
});

module.exports = router;
