const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { PrismaClient } = require('@prisma/client');
const { getAnalyticsSummary } = require('../analytics/service');

const prisma = new PrismaClient();

/**
 * Generates an Excel workbook (.xlsx) containing both the Audit Register and Non-Conformance (NC) Log.
 * Conforms to ISO 9001:2015 Clause 9.2 and IATF 16949 audit trail documentation standards.
 */
async function generateAuditExcelReport(filters = {}) {
  const { from, to, line, shift, status } = filters;

  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      where.date.lte = toDate;
    }
  }
  if (shift) where.shift = shift.toUpperCase();
  if (status) where.status = status.toUpperCase();

  const planWhere = {};
  if (line) {
    planWhere.line = {
      OR: [
        { id: line },
        { code: line.toUpperCase() },
        { name: { contains: line, mode: 'insensitive' } },
      ],
    };
  }
  if (Object.keys(planWhere).length > 0) where.plan = planWhere;

  // Query schedules and NCs
  const [schedules, ncs] = await Promise.all([
    prisma.schedule.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        plan: { include: { line: true, department: true } },
        auditor: { select: { id: true, name: true, email: true } },
        inspection: {
          include: {
            items: true,
            ncs: true,
          },
        },
      },
    }),
    prisma.nC.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        line: true,
        auditee: { select: { name: true } },
        checklistItem: true,
        capa: { include: { owner: { select: { name: true } } } },
        approvals: { include: { byUser: { select: { name: true, role: true } } } },
      },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AuditPulse 360 Quality Engine';
  workbook.lastModifiedBy = 'AuditPulse System';
  workbook.created = new Date();

  // ----------------------------------------------------
  // SHEET 1: Audit Register
  // ----------------------------------------------------
  const auditSheet = workbook.addWorksheet('Audit Register', {
    views: [{ showGridLines: true }],
  });

  // Title block
  auditSheet.mergeCells('A1:N1');
  const titleCell = auditSheet.getCell('A1');
  titleCell.value = 'AUDITPULSE 360 — INTERNAL AUDIT REGISTER (IATF 16949 / ISO 9001:2015)';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  auditSheet.getRow(1).height = 32;

  // Metadata row
  auditSheet.mergeCells('A2:N2');
  const metaCell = auditSheet.getCell('A2');
  metaCell.value = `Exported: ${new Date().toLocaleString()} | Total Records: ${schedules.length} | Scope: Quality Management Internal Compliance`;
  metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
  auditSheet.getRow(2).height = 20;

  // Header columns
  const auditHeaders = [
    'Schedule ID',
    'Audit Date',
    'Shift',
    'Line Name',
    'Line Code',
    'Department',
    'Part / Product',
    'Audit Type',
    'Assigned Auditor',
    'Schedule Status',
    'Checklist Items',
    'Pass Items',
    'Fail Items',
    'Score %',
    'NCs Raised',
  ];

  auditSheet.getRow(4).values = auditHeaders;
  const headerRow = auditSheet.getRow(4);
  headerRow.height = 24;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Data rows
  schedules.forEach((sch, idx) => {
    const insp = sch.inspection;
    const items = insp?.items || [];
    const passCount = items.filter((i) => i.result === 'PASS').length;
    const failCount = items.filter((i) => i.result === 'FAIL').length;
    const scorePct = items.length > 0 ? Math.round((passCount / items.length) * 100) : 0;

    const row = auditSheet.addRow([
      sch.id.slice(0, 8),
      new Date(sch.date).toISOString().split('T')[0],
      sch.shift.replace('_', ' '),
      sch.plan.line.name,
      sch.plan.line.code,
      sch.plan.department.name,
      sch.plan.product,
      sch.plan.auditType,
      sch.auditor.name,
      sch.status,
      items.length,
      passCount,
      failCount,
      `${scorePct}%`,
      insp?.ncs?.length || 0,
    ]);

    row.height = 20;
    row.font = { size: 10 };
    row.alignment = { vertical: 'middle' };

    // Zebra striping
    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }

    // Border
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Adjust column widths
  auditSheet.columns.forEach((col) => {
    col.width = 18;
  });
  auditSheet.getColumn(1).width = 12;
  auditSheet.getColumn(4).width = 24;
  auditSheet.getColumn(7).width = 20;

  // ----------------------------------------------------
  // SHEET 2: Non-Conformance (NC) Register
  // ----------------------------------------------------
  const ncSheet = workbook.addWorksheet('NC Register', {
    views: [{ showGridLines: true }],
  });

  ncSheet.mergeCells('A1:L1');
  const ncTitle = ncSheet.getCell('A1');
  ncTitle.value = 'AUDITPULSE 360 — NON-CONFORMANCE & CAPA TRACKING REGISTER';
  ncTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  ncTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
  ncTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  ncSheet.getRow(1).height = 32;

  const ncHeaders = [
    'NC Ticket No',
    'Line',
    'Severity',
    'Status',
    'Target SLA Date',
    'Closed Date',
    'Auditee Assigned',
    'Checklist Finding',
    '5-Why Root Cause',
    'Corrective Action',
    'Preventive Action',
    'Tier 2 Approved',
  ];

  ncSheet.getRow(3).values = ncHeaders;
  const ncHeaderRow = ncSheet.getRow(3);
  ncHeaderRow.height = 24;
  ncHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  ncHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  ncHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  ncs.forEach((nc, idx) => {
    const isApproved = nc.approvals?.some(
      (a) => a.stage === 'TIER_2_QUALITY_MANAGER' && a.decision === 'APPROVED'
    );

    const row = ncSheet.addRow([
      nc.ncNo,
      nc.line.name,
      nc.severity,
      nc.status,
      new Date(nc.targetDate).toISOString().split('T')[0],
      nc.closedAt ? new Date(nc.closedAt).toISOString().split('T')[0] : 'OPEN',
      nc.auditee?.name || 'Unassigned',
      nc.checklistItem?.itemText || '',
      nc.capa?.rootCause || 'Pending RCA',
      nc.capa?.corrective || 'Pending Action',
      nc.capa?.preventive || 'Pending Action',
      isApproved ? 'YES' : 'NO',
    ]);

    row.height = 20;
    row.font = { size: 9 };
    row.alignment = { vertical: 'middle' };

    // Severity color hint
    const severityCell = row.getCell(3);
    if (nc.severity === 'CRITICAL') {
      severityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      severityCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    } else if (nc.severity === 'MAJOR') {
      severityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      severityCell.font = { bold: true, color: { argb: 'FF92400E' } };
    }

    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  ncSheet.columns.forEach((col) => {
    col.width = 16;
  });
  ncSheet.getColumn(8).width = 28;
  ncSheet.getColumn(9).width = 28;
  ncSheet.getColumn(10).width = 28;

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generates an executive summary PDF compliance report using PDFKit.
 * Suitable for Plant Manager management reviews and ISO/IATF registrar audit packages.
 */
async function generateExecutivePdfReport(filters = {}) {
  const metrics = await getAnalyticsSummary(filters);
  const now = new Date();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: 'AuditPulse 360 Executive Quality & Compliance Report',
          Author: 'AuditPulse 360 Quality Engine',
          Subject: 'ISO 9001:2015 / IATF 16949 Audit Performance',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- BRAND HEADER ---
      doc.rect(40, 40, 515, 60).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
        .text('AUDITPULSE 360 — QUALITY ASSURANCE', 55, 52);
      doc.fontSize(9).font('Helvetica')
        .text('DIGITAL AUDIT & REVALIDATION PLATFORM | ISO 9001:2015 / IATF 16949', 55, 72);
      doc.fillColor('#94a3b8').fontSize(8)
        .text(`Report Generated: ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString()}`, 55, 84);

      doc.moveDown(3);

      // --- DOCUMENT TITLE & SCOPE ---
      doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold')
        .text('Executive Audit & NC Performance Assessment', 40, 115);
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text('Comprehensive evaluation of shop-floor audit execution, non-conformance closure, and MTTC turnaround metrics.', 40, 132);

      // --- KPI TILES ROW ---
      const yTile = 150;
      const tileWidth = 98;
      const tileHeight = 55;

      const kpis = [
        { label: 'Completion Rate', value: `${metrics.kpis?.auditCompletionRate || 0}%`, color: '#2563eb' },
        { label: 'Total Audits', value: `${metrics.kpis?.totalAudits || 0}`, color: '#0f172a' },
        { label: 'NCs Raised', value: `${metrics.kpis?.totalNcs || 0}`, color: '#dc2626' },
        { label: 'On-Time Closure', value: `${metrics.kpis?.onTimeClosureRate || 0}%`, color: '#059669' },
        { label: 'Mean Time (MTTC)', value: `${metrics.kpis?.meanTimeToCloseDays || 0}d`, color: '#7c3aed' },
      ];

      kpis.forEach((kpi, idx) => {
        const xTile = 40 + idx * (tileWidth + 6);
        doc.rect(xTile, yTile, tileWidth, tileHeight).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
          .text(kpi.label.toUpperCase(), xTile + 6, yTile + 10, { width: tileWidth - 12, align: 'center' });
        doc.fillColor(kpi.color).fontSize(14).font('Helvetica-Bold')
          .text(kpi.value, xTile + 6, yTile + 28, { width: tileWidth - 12, align: 'center' });
      });

      // --- TABLE 1: PERFORMANCE BY PRODUCTION LINE ---
      let yLine = 225;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
        .text('1. Production Line Audit Execution & Compliance', 40, yLine);

      yLine += 18;
      // Header row
      doc.rect(40, yLine, 515, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('LINE NAME', 48, yLine + 6);
      doc.text('SCHEDULED', 200, yLine + 6);
      doc.text('COMPLETED', 280, yLine + 6);
      doc.text('COMPLETION %', 360, yLine + 6);
      doc.text('COMPLIANCE STATUS', 440, yLine + 6);

      yLine += 20;
      const lineData = metrics.lineBreakdown || [];
      lineData.forEach((row, idx) => {
        const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        doc.rect(40, yLine, 515, 20).fillAndStroke(bg, '#f1f5f9');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
        doc.text(row.name, 48, yLine + 6);
        doc.text(`${row.scheduled}`, 200, yLine + 6);
        doc.text(`${row.completed}`, 280, yLine + 6);
        doc.text(`${row.completionRate}%`, 360, yLine + 6);

        const statusColor = row.completionRate >= 90 ? '#059669' : row.completionRate >= 75 ? '#d97706' : '#dc2626';
        const statusText = row.completionRate >= 90 ? 'EXCELLENT' : row.completionRate >= 75 ? 'ACCEPTABLE' : 'NEEDS ACTION';
        doc.fillColor(statusColor).font('Helvetica-Bold').text(statusText, 440, yLine + 6);

        yLine += 20;
      });

      // --- TABLE 2: NC AGING & SEVERITY CLASSIFICATION ---
      yLine += 15;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
        .text('2. Non-Conformance (NC) Aging & SLA Risk Breakdown', 40, yLine);

      yLine += 18;
      doc.rect(40, yLine, 515, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('AGING BUCKET', 48, yLine + 6);
      doc.text('ACTIVE NC COUNT', 180, yLine + 6);
      doc.text('CRITICAL DEFECTS', 290, yLine + 6);
      doc.text('SLA RISK ASSESSMENT', 410, yLine + 6);

      yLine += 20;
      const agingData = metrics.agingBuckets || [];
      agingData.forEach((bucket, idx) => {
        const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        doc.rect(40, yLine, 515, 20).fillAndStroke(bg, '#f1f5f9');
        doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
        doc.text(bucket.bucket, 48, yLine + 6);
        doc.text(`${bucket.count}`, 180, yLine + 6);
        doc.text(`${bucket.critical || 0}`, 290, yLine + 6);

        const risk = bucket.bucket.includes('>30') ? 'HIGH OVERDUE RISK' : bucket.bucket.includes('15-30') ? 'MODERATE RISK' : 'HEALTHY SLA';
        const riskColor = risk.includes('HIGH') ? '#dc2626' : risk.includes('MODERATE') ? '#d97706' : '#059669';
        doc.fillColor(riskColor).font('Helvetica-Bold').text(risk, 410, yLine + 6);

        yLine += 20;
      });

      // --- SECTION 3: TOP RECURRING DEFECTS ---
      yLine += 15;
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
        .text('3. Top Recurring Quality Findings (Pareto Focus)', 40, yLine);

      yLine += 18;
      const recurring = metrics.topDefects || [];
      if (recurring.length > 0) {
        recurring.slice(0, 3).forEach((def) => {
          doc.rect(40, yLine, 515, 26).fillAndStroke('#fff7ed', '#fed7aa');
          doc.fillColor('#9a3412').fontSize(8).font('Helvetica-Bold')
            .text(`${def.checklistItem || 'Item'} (${def.failCount} occurrences)`, 48, yLine + 5);
          doc.fillColor('#7c2d12').fontSize(7.5).font('Helvetica')
            .text(`Section: ${def.section || 'General'} | Primary Severity: ${def.severity || 'MAJOR'}`, 48, yLine + 15);
          yLine += 30;
        });
      } else {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b')
          .text('No recurring defect patterns identified during this evaluation period.', 48, yLine + 6);
        yLine += 20;
      }

      // --- SIGN-OFF BLOCK (IATF 16949 / ISO 9001 MANDATORY) ---
      yLine += 20;
      doc.rect(40, yLine, 515, 75).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
        .text('OFFICIAL VERIFICATION & COMPLIANCE SIGN-OFF', 50, yLine + 10);

      const signBoxY = yLine + 28;
      doc.fontSize(8).font('Helvetica').fillColor('#475569');

      // Box 1: Lead Auditor
      doc.text('Prepared By:', 50, signBoxY);
      doc.font('Helvetica-Bold').fillColor('#1e293b').text('Lead Quality Auditor', 50, signBoxY + 12);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Date: ______________', 50, signBoxY + 24);

      // Box 2: Line Lead
      doc.fontSize(8).font('Helvetica').fillColor('#475569');
      doc.text('Reviewed By:', 220, signBoxY);
      doc.font('Helvetica-Bold').fillColor('#1e293b').text('Operations / Line Head', 220, signBoxY + 12);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Date: ______________', 220, signBoxY + 24);

      // Box 3: QMR
      doc.fontSize(8).font('Helvetica').fillColor('#475569');
      doc.text('Approved By:', 390, signBoxY);
      doc.font('Helvetica-Bold').fillColor('#1e293b').text('Quality Management Rep (QMR)', 390, signBoxY + 12);
      doc.font('Helvetica').fontSize(7).fillColor('#64748b').text('Date: ______________', 390, signBoxY + 24);

      // --- FOOTER ---
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
        .text('Confidential — AuditPulse 360 Quality Assurance Management System. For Internal Compliance Audit Use Only.', 40, 780, {
          width: 515,
          align: 'center',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateAuditExcelReport,
  generateExecutivePdfReport,
};
