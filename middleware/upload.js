const multer = require('multer');

// Allowed MIME types for images
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Configure multer with memory storage (no disk writes)
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedMimeTypes.join(', ')} are allowed.`), false);
  }
};

// Configure upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

module.exports = { upload };
