const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/evidence - Upload defect photo evidence (Linga's contract)
router.post('/', upload.single('file'), (req, res, next) => {
  try {
    const file = req.file;
    const evidenceId = `ev-${Date.now()}`;
    const fileName = file ? file.filename : 'photo.jpg';
    const fileUrl = file ? `/uploads/${file.filename}` : 'https://placehold.co/400x300';

    return res.status(201).json({
      id: evidenceId,
      fileName,
      url: fileUrl,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
