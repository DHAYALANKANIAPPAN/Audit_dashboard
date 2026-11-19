const express = require('express');
const {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('./service');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await listNotifications(req.user.id);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    const result = await markAllNotificationsAsRead(req.user.id);
    res.json({ success: true, count: result.count });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const updated = await markNotificationAsRead(req.params.id, req.user.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
