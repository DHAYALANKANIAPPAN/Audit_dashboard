
const express = require('express');
const router = express.Router();

const inspectionController = require('./controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Only authenticated auditors can submit completed inspections.
router.post(
  '/',
  requireAuth,
  requireRole('AUDITOR'),
  inspectionController.createInspection
);

// Retrieve inspection details.
router.get('/:id', requireAuth, inspectionController.getInspectionById);

module.exports = router;
