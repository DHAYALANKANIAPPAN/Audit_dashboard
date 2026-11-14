const express = require('express');
const { searchHistory, getAuditTimeline, getNcTimeline } = require('./service');

const router = express.Router();

/**
 * GET /api/history
 * Multi-criteria search and filter across historical audit schedules and NCs
 */
router.get('/', async (req, res) => {
  try {
    const results = await searchHistory(req.query);
    res.json(results);
  } catch (err) {
    console.error('[History API Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to search audit history' });
  }
});

/**
 * GET /api/history/nc/:ncIdOrNo
 * End-to-end timeline drilldown by NC ID or Ticket Number
 */
router.get('/nc/:ncIdOrNo', async (req, res) => {
  try {
    const timeline = await getNcTimeline(req.params.ncIdOrNo);
    if (!timeline) {
      return res.status(404).json({ error: `NC '${req.params.ncIdOrNo}' not found` });
    }
    res.json(timeline);
  } catch (err) {
    console.error('[History NC Timeline Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch NC timeline' });
  }
});

/**
 * GET /api/history/:scheduleId
 * End-to-end 6-stage lifecycle audit timeline drilldown by schedule ID
 */
router.get('/:scheduleId', async (req, res) => {
  try {
    const timeline = await getAuditTimeline(req.params.scheduleId);
    if (!timeline) {
      return res.status(404).json({ error: `Audit schedule '${req.params.scheduleId}' not found` });
    }
    res.json(timeline);
  } catch (err) {
    console.error('[History Schedule Timeline Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch audit timeline' });
  }
});

module.exports = router;
