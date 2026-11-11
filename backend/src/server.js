const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

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
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
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
