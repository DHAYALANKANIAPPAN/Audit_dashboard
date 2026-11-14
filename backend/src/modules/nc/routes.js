const express = require('express');
const { listNcs, getNcDetail, submitCapa } = require('./service');

const router = express.Router();

/**
 * GET /api/ncs
 * List NC tickets with filters
 */
router.get('/', async (req, res) => {
  try {
    const ncs = await listNcs(req.query);
    res.json(ncs);
  } catch (err) {
    console.error('[NC List Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to list NCs' });
  }
});

/**
 * GET /api/ncs/:id
 * Get single NC ticket details
 */
router.get('/:id', async (req, res) => {
  try {
    const nc = await getNcDetail(req.params.id);
    if (!nc) {
      return res.status(404).json({ error: `NC '${req.params.id}' not found` });
    }
    res.json(nc);
  } catch (err) {
    console.error('[NC Detail Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to get NC detail' });
  }
});

/**
 * POST /api/ncs/:id/capa
 * Submit CAPA plan for an NC ticket
 */
router.post('/:id/capa', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.ownerId;
    const result = await submitCapa(req.params.id, req.body, userId);
    res.status(201).json(result);
  } catch (err) {
    console.error('[CAPA Submit Error]:', err);
    res.status(400).json({ error: err.message || 'Failed to submit CAPA' });
  }
});

module.exports = router;
