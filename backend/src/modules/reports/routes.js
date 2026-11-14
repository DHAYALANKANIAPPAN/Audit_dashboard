const express = require('express');
const { generateAuditExcelReport, generateExecutivePdfReport } = require('./service');

const router = express.Router();

/**
 * GET /api/reports/export/excel
 * Download Excel workbook (.xlsx) containing Audit Register and NC Log
 */
router.get('/export/excel', async (req, res) => {
  try {
    const buffer = await generateAuditExcelReport(req.query);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `AuditPulse360_Report_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Excel Export Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to export Excel report' });
  }
});

/**
 * GET /api/reports/export/pdf
 * Download or stream publication-grade Executive Summary PDF report
 */
router.get('/export/pdf', async (req, res) => {
  try {
    const buffer = await generateExecutivePdfReport(req.query);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `AuditPulse360_Executive_Summary_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[PDF Export Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to export PDF report' });
  }
});

module.exports = router;
