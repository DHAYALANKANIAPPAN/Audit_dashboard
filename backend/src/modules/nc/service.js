const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// In-memory fallback map for stubbing/offline compatibility
const ncsStore = new Map();

/**
 * Creates Non-Conformance (NC) tickets from failed inspection checklist items.
 * Persists to PostgreSQL database and updates fallback store.
 */
async function createNcsFromInspection(inspection) {
  if (!inspection || !inspection.items) {
    return [];
  }

  const failedItems = inspection.items.filter((item) => item.result === 'FAIL');
  if (failedItems.length === 0) return [];

  const now = new Date();
  const generatedNcs = [];

  for (let idx = 0; idx < failedItems.length; idx++) {
    const item = failedItems[idx];
    const slaDays = item.severity === 'CRITICAL' ? 3 : item.severity === 'MAJOR' ? 7 : 14;
    const targetDate = new Date(now.getTime() + slaDays * 24 * 60 * 60 * 1000);

    const count = await prisma.nC.count();
    const ncNumber = `NC-${now.getFullYear()}-${String(count + idx + 1).padStart(4, '0')}`;

    try {
      // Find line and auditee from inspection or schedule
      let lineId = inspection.lineId;
      let auditeeId = inspection.auditeeId;

      if (!lineId || !auditeeId) {
        const schedule = await prisma.schedule.findUnique({
          where: { id: inspection.scheduleId },
          include: { plan: { include: { line: true } } },
        });
        if (schedule) {
          lineId = lineId || schedule.plan.line.id;
          auditeeId = auditeeId || schedule.plan.line.ownerId;
        }
      }

      if (lineId && auditeeId) {
        const nc = await prisma.nC.create({
          data: {
            ncNo: ncNumber,
            inspectionId: inspection.id,
            checklistItemId: item.checklistItemId,
            lineId,
            auditeeId,
            severity: item.severity || 'MAJOR',
            status: 'OPEN',
            targetDate,
            createdAt: now,
          },
          include: {
            line: true,
            checklistItem: true,
            auditee: true,
          },
        });
        generatedNcs.push(nc);
      }
    } catch (err) {
      console.warn('[NC Service] Failed to persist NC to database, using memory fallback:', err.message);
      const ncRecord = {
        id: `nc-${Date.now()}-${idx + 1}`,
        ncNo: ncNumber,
        inspectionId: inspection.id,
        severity: item.severity || 'MAJOR',
        status: 'OPEN',
        targetDate: targetDate.toISOString(),
      };
      ncsStore.set(ncRecord.id, ncRecord);
      generatedNcs.push(ncRecord);
    }
  }

  return generatedNcs;
}

/**
 * List all NC tickets with comprehensive multi-criteria filtering
 */
async function listNcs(filters = {}) {
  const { status, severity, lineId, auditeeId, overdue, search } = filters;
  const now = new Date();

  const where = {};

  if (status) {
    if (status === 'OVERDUE') {
      where.status = { not: 'CLOSED' };
      where.targetDate = { lt: now };
    } else {
      where.status = status.toUpperCase();
    }
  }

  if (severity) {
    where.severity = severity.toUpperCase();
  }

  if (lineId) {
    where.lineId = lineId;
  }

  if (auditeeId) {
    where.auditeeId = auditeeId;
  }

  if (overdue === 'true') {
    where.status = { not: 'CLOSED' };
    where.targetDate = { lt: now };
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { ncNo: { contains: term, mode: 'insensitive' } },
      { line: { name: { contains: term, mode: 'insensitive' } } },
      { checklistItem: { itemText: { contains: term, mode: 'insensitive' } } },
      { auditee: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  const ncs = await prisma.nC.findMany({
    where,
    orderBy: [{ status: 'asc' }, { targetDate: 'asc' }],
    include: {
      line: true,
      auditee: { select: { id: true, name: true, email: true, role: true } },
      checklistItem: true,
      capa: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          evidence: true,
        },
      },
      approvals: {
        include: {
          byUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      evidence: true,
      inspection: {
        include: {
          schedule: {
            include: {
              auditor: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  return ncs.map((nc) => {
    const isOverdue = nc.status !== 'CLOSED' && new Date(nc.targetDate) < now;
    const diffMs = new Date(nc.targetDate) - now;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const tier1Approved = nc.approvals.some((a) => a.stage === 'AUDITOR_VERIFY' && a.decision === 'ACCEPT');
    const tier2Approved = nc.approvals.some((a) => a.stage === 'HEAD_SIGNOFF' && a.decision === 'ACCEPT');

    return {
      ...nc,
      isOverdue,
      daysRemaining,
      tier1Approved,
      tier2Approved,
      hasCapa: !!nc.capa,
    };
  });
}

/**
 * Get NC ticket detail by ID or Ticket Number
 */
async function getNcDetail(idOrNo) {
  const nc = await prisma.nC.findFirst({
    where: {
      OR: [{ id: idOrNo }, { ncNo: idOrNo }],
    },
    include: {
      line: true,
      auditee: true,
      checklistItem: true,
      capa: {
        include: {
          owner: true,
          evidence: true,
        },
      },
      approvals: {
        include: {
          byUser: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      evidence: true,
      inspection: {
        include: {
          schedule: {
            include: {
              auditor: true,
              plan: true,
            },
          },
        },
      },
    },
  });

  if (!nc) return null;

  const now = new Date();
  const isOverdue = nc.status !== 'CLOSED' && new Date(nc.targetDate) < now;

  return {
    ...nc,
    isOverdue,
  };
}

/**
 * Submit CAPA (Corrective and Preventive Action) for an open NC ticket.
 * Moves ticket to 'SUBMITTED' status awaiting Tier 1 Auditor Verification.
 */
async function submitCapa(ncId, data, userId) {
  const { rootCauseMethod = 'FIVE_WHY', rootCause, corrective, preventive, targetDate } = data;

  const nc = await prisma.nC.findUnique({
    where: { id: ncId },
  });

  if (!nc) {
    throw new Error(`NC ticket '${ncId}' not found.`);
  }

  // Create or update CAPA
  const targetDateObj = targetDate ? new Date(targetDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const rootCauseStr = typeof rootCause === 'object' ? JSON.stringify(rootCause) : String(rootCause);

  const capa = await prisma.capa.upsert({
    where: { ncId },
    create: {
      ncId,
      rootCauseMethod,
      rootCause: rootCauseStr,
      corrective,
      preventive,
      ownerId: userId || nc.auditeeId,
      targetDate: targetDateObj,
    },
    update: {
      rootCauseMethod,
      rootCause: rootCauseStr,
      corrective,
      preventive,
      ownerId: userId || nc.auditeeId,
      targetDate: targetDateObj,
    },
  });

  // Advance NC status to SUBMITTED
  const updatedNc = await prisma.nC.update({
    where: { id: ncId },
    data: {
      status: 'SUBMITTED',
    },
    include: {
      line: true,
      capa: true,
      approvals: true,
    },
  });

  return {
    success: true,
    nc: updatedNc,
    capa,
  };
}

module.exports = {
  createNcsFromInspection,
  listNcs,
  getNcDetail,
  submitCapa,
  ncsStore,
};
