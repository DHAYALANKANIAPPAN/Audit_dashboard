const express = require('express');
const {
  listNcs,
  getNcDetail,
  startNc,
  submitCapa
} = require('./service');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { decideApproval } = require('../approvals/service');

const router = express.Router();

// List visibility is determined by the authenticated user's role.
router.get(
  '/',
  requireAuth,
  requireRole('AUDITEE', 'AUDITOR', 'AUDIT_HEAD', 'ADMIN', 'PLANT_MANAGER'),
  async (req, res, next) => {
    try {
      const filters = { ...req.query };
      const isMine = req.query.mine === '1' || req.query.mine === 'true';

      if (req.user.role === 'AUDITEE') {
        filters.auditeeId = req.user.id;
      } else if (isMine && req.user.role === 'AUDITOR') {
        filters.raisedByAuditorId = req.user.id;
      }

      res.json(await listNcs(filters));
    } catch (err) {
      next(err);
    }
  }
);

// Start an NC assigned to the authenticated auditee.
router.patch(
  '/:id/start',
  requireAuth,
  requireRole('AUDITEE'),
  async (req, res, next) => {
    try {
      const nc = await startNc(req.params.id, req.user.id);
      res.json({ success: true, nc });
    } catch (err) {
      next(err);
    }
  }
);

// Get an NC detail. Role-specific visibility is checked before returning it.
router.get(
  '/:id',
  requireAuth,
  requireRole('AUDITEE', 'AUDITOR', 'AUDIT_HEAD', 'ADMIN'),
  async (req, res, next) => {
    try {
      const nc = await getNcDetail(req.params.id);

      if (!nc) return res.status(404).json({ error: 'NC not found' });

      if (req.user.role === 'AUDITEE' && nc.auditeeId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (
        req.user.role === 'AUDITOR' &&
        nc.inspection?.schedule?.auditorId !== req.user.id
      ) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(nc);
    } catch (err) {
      next(err);
    }
  }
);

// Submit CAPA. Only the assigned auditee can submit.
router.post(
  '/:id/capa',
  requireAuth,
  requireRole('AUDITEE'),
  async (req, res, next) => {
    try {
      const result = await submitCapa(req.params.id, req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);



// Auditor verification of a submitted CAPA.
router.post(
  '/:id/verify',
  requireAuth,
  requireRole('AUDITOR'),
  async (req, res, next) => {
    try {
      const result = await decideApproval(req.params.id, {
        stage: 'AUDITOR_VERIFY',
        decision: req.body.decision,
        remark: req.body.remark,
        userId: req.user.id,
        userRole: req.user.role,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Audit-head final sign-off of a verified NC.
router.post(
  '/:id/close',
  requireAuth,
  requireRole('AUDIT_HEAD'),
  async (req, res, next) => {
    try {
      const result = await decideApproval(req.params.id, {
        stage: 'HEAD_SIGNOFF',
        decision: req.body.decision,
        remark: req.body.remark,
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
