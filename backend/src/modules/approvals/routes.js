const express = require('express');
const { getPendingApprovals, decideApproval } = require('./service');

const router = express.Router();

/**
 * GET /api/approvals/pending
 * Get all pending approvals grouped by Tier 1 and Tier 2
 */
router.get('/pending', async (req, res) => {
  try {
    const data = await getPendingApprovals();
    res.json(data);
  } catch (err) {
    console.error('[Approvals List Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to get pending approvals' });
  }
});

/**
 * POST /api/approvals/:ncId/decide
 * Submit approval decision (ACCEPT or REJECT)
 */
router.post('/:ncId/decide', async (req, res) => {
  try {
    const { stage, decision, remark } = req.body;
    const userId = req.user?.id || req.body.userId;
    const result = await decideApproval(req.params.ncId, {
      stage,
      decision,
      remark,
      userId,
    });
    res.status(200).json(result);
  } catch (err) {
    console.error('[Approvals Decide Error]:', err);
    res.status(400).json({ error: err.message || 'Failed to submit approval decision' });
  }
});

module.exports = router;
