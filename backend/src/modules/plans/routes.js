const express = require('express');
const multer = require('multer');
const { getPlanTemplateCsv, processPlanUpload, getAuditPlans } = require('./service');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// GET /api/plans/template
router.get('/template', (req, res) => {
  const csvData = getPlanTemplateCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-plan-template.csv"');
  res.status(200).send(csvData);
});

// POST /api/plans/upload
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload a CSV or Excel file.' });
    }

    const result = await processPlanUpload(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/plans?month=YYYY-MM
router.get('/', async (req, res, next) => {
  try {
    const { month } = req.query;
    const plans = await getAuditPlans(month);
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
