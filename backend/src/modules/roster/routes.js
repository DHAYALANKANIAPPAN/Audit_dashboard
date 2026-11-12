const express = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  generateRoster,
  getRoster,
  reassignSchedule,
  getMySchedules,
  markMissedSchedules,
} = require('./service');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/roster/generate
router.post('/generate', async (req, res, next) => {
  try {
    const { month, date } = req.body;
    const result = await generateRoster({ month, date });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/roster?date=YYYY-MM-DD or ?month=YYYY-MM
router.get('/', async (req, res, next) => {
  try {
    const { date, month } = req.query;
    const schedules = await getRoster({ date, month });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// POST /api/roster/mark-missed
router.post('/mark-missed', async (req, res, next) => {
  try {
    const result = await markMissedSchedules();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/roster/auditors (Utility for calendar reassign dropdown)
router.get('/auditors', async (req, res, next) => {
  try {
    const auditors = await prisma.user.findMany({
      where: { role: 'AUDITOR' },
      select: { id: true, name: true, email: true },
    });
    res.json(auditors);
  } catch (err) {
    next(err);
  }
});

// Schedules Routes (Also reachable at /api/schedules/)
// GET /api/schedules/mine
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const schedules = await getMySchedules(req.user.id, req.query.date);
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/schedules/:id/reassign
router.patch('/:id/reassign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { auditorId } = req.body;
    if (!auditorId) {
      return res.status(400).json({ error: 'auditorId is required' });
    }
    const updated = await reassignSchedule(id, auditorId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/schedules/:id/start
router.patch('/:id/start', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await prisma.schedule.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
