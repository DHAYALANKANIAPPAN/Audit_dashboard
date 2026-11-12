const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SAMPLE_CSV = `month,auditType,line,department,product,plannedDate,shift
2026-11,PRODUCT,L1-CHASSIS,MFG,Model-X Subframe Assembly,2026-11-15,A
2026-11,REVALIDATION,L2-POWERTRAIN,MFG,EV Inverter Power Unit,2026-11-16,B
2026-11,PRODUCT,L3-FINAL,MFG,Body Door Latches & Weatherstrips,2026-11-17,C
2026-11,PRODUCT,L1-CHASSIS,MFG,Front Suspension Knuckle,2026-11-18,A
2026-11,REVALIDATION,L2-POWERTRAIN,MFG,High Voltage Battery Module,2026-11-19,B
`;

function getPlanTemplateCsv() {
  return SAMPLE_CSV;
}

/**
 * Parses raw buffer (CSV or Excel) into array of normalized row objects
 */
async function parseRows(buffer, filename = '') {
  const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls');

  if (isExcel) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const rows = [];
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1); // ExcelJS values are 1-indexed
      if (rowNumber === 1) {
        headers = values.map((v) => String(v).trim());
      } else {
        const rowObj = {};
        headers.forEach((h, idx) => {
          let val = values[idx];
          if (val instanceof Date) {
            val = val.toISOString().split('T')[0];
          }
          rowObj[h] = val !== undefined && val !== null ? String(val).trim() : '';
        });
        rows.push({ rowNumber, data: rowObj });
      }
    });

    return rows;
  } else {
    // Parse CSV
    const content = buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((data, idx) => ({
      rowNumber: idx + 2, // Row 1 is header
      data,
    }));
  }
}

/**
 * Validates rows against database records (Line, Department) and domain enums.
 * Valid rows are inserted; invalid rows produce detailed error feedback.
 */
async function processPlanUpload(buffer, filename) {
  const parsed = await parseRows(buffer, filename);
  if (!parsed || parsed.length === 0) {
    return { inserted: 0, errors: [{ row: 1, message: 'File is empty or contains no valid rows' }] };
  }

  // Pre-load lines and departments for rapid in-memory validation
  const [lines, departments] = await Promise.all([
    prisma.line.findMany(),
    prisma.department.findMany(),
  ]);

  const lineMap = new Map();
  lines.forEach((l) => {
    lineMap.set(l.code.toUpperCase(), l);
    lineMap.set(l.name.toUpperCase(), l);
  });

  const deptMap = new Map();
  departments.forEach((d) => {
    deptMap.set(d.code.toUpperCase(), d);
    deptMap.set(d.name.toUpperCase(), d);
  });

  const validRows = [];
  const errors = [];

  for (const item of parsed) {
    const { rowNumber, data } = item;
    const rowErrors = [];

    // 1. Month validation (YYYY-MM)
    const month = data.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      rowErrors.push("Invalid month format (expected 'YYYY-MM', e.g. '2026-11')");
    }

    // 2. AuditType validation
    const auditType = data.auditType ? data.auditType.toUpperCase() : '';
    if (!['PRODUCT', 'REVALIDATION'].includes(auditType)) {
      rowErrors.push("auditType must be 'PRODUCT' or 'REVALIDATION'");
    }

    // 3. Line validation
    const lineKey = data.line ? data.line.toUpperCase() : '';
    const line = lineMap.get(lineKey);
    if (!line) {
      rowErrors.push(`Line '${data.line}' not recognized in system`);
    }

    // 4. Department validation
    const deptKey = data.department ? data.department.toUpperCase() : '';
    const department = deptMap.get(deptKey) || (line ? departments.find((d) => d.id === line.departmentId) : null);
    if (!department) {
      rowErrors.push(`Department '${data.department}' not recognized in system`);
    }

    // 5. Product validation
    const product = data.product ? data.product.trim() : '';
    if (!product) {
      rowErrors.push('Product name is required');
    }

    // 6. PlannedDate validation
    const plannedDateStr = data.plannedDate;
    const plannedDate = new Date(plannedDateStr);
    if (!plannedDateStr || isNaN(plannedDate.getTime())) {
      rowErrors.push("Invalid plannedDate (expected 'YYYY-MM-DD')");
    }

    // 7. Shift validation
    const shift = data.shift ? data.shift.toUpperCase() : '';
    if (!['A', 'B', 'C'].includes(shift)) {
      rowErrors.push("Shift must be 'A', 'B', or 'C'");
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        message: rowErrors.join('; '),
      });
    } else {
      validRows.push({
        month,
        auditType,
        lineId: line.id,
        departmentId: department.id,
        product,
        plannedDate,
        shift,
      });
    }
  }

  // Insert all valid rows into Database
  let inserted = 0;
  if (validRows.length > 0) {
    const created = await prisma.auditPlan.createMany({
      data: validRows,
    });
    inserted = created.count;
  }

  return {
    inserted,
    errors,
  };
}

async function getAuditPlans(month) {
  const where = {};
  if (month) {
    where.month = month;
  }

  return prisma.auditPlan.findMany({
    where,
    include: {
      line: {
        select: { id: true, name: true, code: true, owner: { select: { id: true, name: true, email: true } } },
      },
      department: {
        select: { id: true, name: true, code: true },
      },
      schedules: {
        include: {
          auditor: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { plannedDate: 'asc' },
  });
}

module.exports = {
  getPlanTemplateCsv,
  processPlanUpload,
  getAuditPlans,
};
