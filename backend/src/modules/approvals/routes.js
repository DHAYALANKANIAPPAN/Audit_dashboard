const express = require('express');
const { getPendingApprovals, decideApproval } = require('./service');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.get(
  '/pending',
  requireAuth,
  requireRole('AUDITOR', 'AUDIT_HEAD', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await getPendingApprovals({
        role: req.user.role,
        userId: req.user.id,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:ncId/decide',
  requireAuth,
  requireRole('AUDITOR', 'AUDIT_HEAD', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { stage, decision, remark } = req.body;
      const result = await decideApproval(req.params.ncId, {
        stage,
        decision,
        remark,
        userId: req.user.id,
        userRole: req.user.role,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
