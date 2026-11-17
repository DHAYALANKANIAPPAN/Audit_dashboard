const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireRole } = require('../../middleware/auth');

const prisma = new PrismaClient();
const uploadsDir = path.join(__dirname, '../../../uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP images and PDF files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/evidence - Store file and create a real database record.
router.post(
  '/',
  requireAuth,
  requireRole('AUDITOR', 'AUDITEE'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res, next) => {
    let uploadedPath;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'A file is required in the "file" field' });
      }

      uploadedPath = req.file.path;

      const evidence = await prisma.evidence.create({
        data: {
          fileName: req.file.originalname,
          url: `/api/evidence/${path.basename(req.file.filename)}`,
          uploadedById: req.user.id,
        },
      });

      res.status(201).json({
        id: evidence.id,
        fileName: evidence.fileName,
        url: evidence.url,
        createdAt: evidence.createdAt,
      });
    } catch (err) {
      if (uploadedPath) {
        try { fs.unlinkSync(uploadedPath); } catch (_) {}
      }
      next(err);
    }
  }
);

// GET /api/evidence/:id - Return the stored file to an authorized user.
router.get(
  '/:id',
  requireAuth,
  async (req, res, next) => {
    try {
      const evidence = await prisma.evidence.findUnique({
        where: { id: req.params.id },
        include: {
          nc: {
            include: {
              inspection: { include: { schedule: true } },
            },
          },
        },
      });

      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      const isOwner = evidence.uploadedById === req.user.id;
      const isAuditee = evidence.nc?.auditeeId === req.user.id;
      const isAssignedAuditor =
        evidence.nc?.inspection?.schedule?.auditorId === req.user.id;
      const isPrivileged = ['AUDIT_HEAD', 'ADMIN'].includes(req.user.role);

      if (!isOwner && !isAuditee && !isAssignedAuditor && !isPrivileged) {
        return res.status(403).json({ error: 'You are not authorized to view this evidence' });
      }

      const filePath = path.join(uploadsDir, path.basename(evidence.url));

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Evidence file is missing from storage' });
      }

      res.type(path.extname(filePath));
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
