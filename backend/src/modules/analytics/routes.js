const express = require('express');
const { getAnalyticsSummary } = require('./service');

const router = express.Router();

// GET /api/analytics/summary?from=&to=&line=&shift=&department=
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getAnalyticsSummary(req.query);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
