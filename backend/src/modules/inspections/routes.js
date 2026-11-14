const express = require('express');
const router = express.Router();
const inspectionController = require('./controller');

// POST /api/inspections - Submit completed inspection
router.post('/', inspectionController.createInspection);

// GET /api/inspections/:id - Retrieve inspection details
router.get('/:id', inspectionController.getInspectionById);

module.exports = router;
