const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const authRouter = require('./modules/auth/routes');
const plansRouter = require('./modules/plans/routes');
const rosterRouter = require('./modules/roster/routes');
const inspectionRoutes = require('./modules/inspections/routes');
const evidenceRoutes = require('./modules/evidence/routes');
const analyticsRouter = require('./modules/analytics/routes');
const historyRouter = require('./modules/history/routes');
const reportsRouter = require('./modules/reports/routes');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    service: 'AuditPulse 360 Backend API',
    timestamp: new Date().toISOString(),
  });
});

// Authentication Router
app.use('/api/auth', authRouter);

// Audit Plans Router
app.use('/api/plans', plansRouter);

// Roster & Schedules Routers
app.use('/api/roster', rosterRouter);
app.use('/api/schedules', rosterRouter);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/analytics', analyticsRouter);
app.use('/api/history', historyRouter);
app.use('/api/reports', reportsRouter);

// Checklist Endpoint (Dhaya's shared contract: GET /api/checklists?auditType=)
app.get('/api/checklists', async (req, res) => {
  try {
    const { auditType } = req.query;
    const items = await prisma.checklistItem.findMany({
      where: auditType ? { auditType: auditType.toUpperCase() } : undefined,
      orderBy: { order: 'asc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[Unhandled Server Error]:', err);
  }
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 AuditPulse 360 API server running on port ${PORT}`);
    console.log(`👉 Health check available at: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
