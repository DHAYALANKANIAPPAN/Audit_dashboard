const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// In-memory fallback map for stubbing/offline compatibility
const ncsStore = new Map();

/**
 * Creates Non-Conformance (NC) tickets from failed inspection checklist items.
 * Persists to PostgreSQL database and updates fallback store.
 */
async function createNcsFromInspection(inspection, tx = null, schedule = null) {
  if (!inspection?.items) {
    return [];
  }

  const failedItems = inspection.items.filter((item) => item.result === 'FAIL');
  if (!failedItems.length) return [];

  const client = tx || prisma;

  let line = schedule?.plan?.line;
  let auditeeId = line?.ownerId;

  if (!line || !auditeeId) {
    if (inspection.scheduleId) {
      try {
        const sched = await client.schedule.findUnique({
          where: { id: inspection.scheduleId },
          include: { plan: { include: { line: true } } }
        });
        line = sched?.plan?.line;
        auditeeId = line?.ownerId;
      } catch (err) {
        console.warn('[NC Service] Failed to fetch schedule for line lookup:', err.message);
      }
    }
  }

  // Fallback if line or auditee was not retrieved from schedule
  if (!line || !auditeeId) {
    line = {
      id: inspection.lineId || 'line-default',
      name: inspection.line || 'Production Line',
      ownerId: inspection.auditeeId || 'usr-auditee-line1'
    };
    auditeeId = line.ownerId;
  }

  const now = new Date();
  const year = now.getFullYear();
  const prefix = `NC-${year}-`;

  let sequence = 1;
  try {
    if (tx && typeof tx.$queryRaw === 'function') {
      try {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(3601142026)`;
      } catch (_) {}
    }

    const latest = await client.nC.findFirst({
      where: { ncNo: { startsWith: prefix } },
      orderBy: { ncNo: 'desc' },
      select: { ncNo: true }
    });

    if (latest) {
      const match = latest.ncNo.match(/NC-\d+-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }
  } catch (err) {
    sequence = ncsStore.size + 1;
  }

  const generatedNcs = [];

  for (const item of failedItems) {
    const severity = item.severity || 'MAJOR';
    const days = severity === 'CRITICAL'
      ? 3
      : severity === 'MAJOR'
        ? 7
        : 14;

    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const ncNo = `${prefix}${String(sequence++).padStart(4, '0')}`;

    try {
      const nc = await client.nC.create({
        data: {
          ncNo,
          inspectionId: inspection.id,
          checklistItemId: item.checklistItemId,
          lineId: line.id,
          auditeeId,
          severity,
          status: 'OPEN',
          targetDate
        },
        include: {
          line: true,
          checklistItem: true,
          auditee: true
        }
      });

      const evidenceIds = item.evidenceIds || (item.evidence ? item.evidence.map((e) => e.id) : []);
      if (evidenceIds.length) {
        await client.evidence.updateMany({
          where: {
            id: { in: evidenceIds },
            ncId: null
          },
          data: { ncId: nc.id }
        });
      }

      await client.notification.create({
        data: {
          userId: auditeeId,
          channel: 'INAPP',
          title: `New NC raised: ${ncNo}`,
          body: `A ${severity} non-conformance has been raised for ${line.name || 'your line'}. Target date: ${targetDate.toLocaleDateString()}.`
        }
      });

      ncsStore.set(nc.id, nc);
      generatedNcs.push(nc);
    } catch (err) {
      console.warn('[NC Service] Failed to persist NC, falling back to memory store:', err.message);
      const ncRecord = {
        id: `nc-${Date.now()}-${generatedNcs.length + 1}`,
        ncNo,
        inspectionId: inspection.id,
        checklistItemId: item.checklistItemId,
        lineId: line.id,
        line: { id: line.id, name: line.name || 'Line 1' },
        auditeeId,
        severity,
        status: 'OPEN',
        targetDate: targetDate.toISOString(),
        createdAt: now.toISOString(),
        isOverdue: false
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
  const { status, severity, lineId, auditeeId, raisedByAuditorId, overdue, search } = filters;
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

  if (raisedByAuditorId) {
    where.inspection = {
      schedule: { auditorId: raisedByAuditorId }
    };
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

/**
 * Start an NC. Only its assigned auditee may start it.
 */
async function startNc(ncId, userId) {
  const nc = await prisma.nC.findUnique({ where: { id: ncId } });

  if (!nc) {
    const error = new Error('NC not found');
    error.status = 404;
    throw error;
  }

  if (nc.auditeeId !== userId) {
    const error = new Error('Only the assigned auditee can start this NC');
    error.status = 403;
    throw error;
  }

  if (nc.status === 'IN_PROGRESS') return nc;

  if (nc.status !== 'OPEN') {
    const error = new Error('Only OPEN NCs can be started');
    error.status = 409;
    throw error;
  }

  return prisma.nC.update({
    where: { id: ncId },
    data: { status: 'IN_PROGRESS' }
  });
}

/**
 * Submit CAPA for an NC assigned to the authenticated auditee.
 */
async function submitCapa(ncId, data, userId) {
  const {
    rootCauseMethod,
    rootCause,
    corrective,
    preventive,
    ownerId,
    targetDate,
    evidenceIds
  } = data;

  const nc = await prisma.nC.findUnique({
    where: { id: ncId },
    include: {
      inspection: {
        include: { schedule: { select: { auditorId: true } } }
      }
    }
  });

  if (!nc) {
    const error = new Error('NC not found');
    error.status = 404;
    throw error;
  }

  if (nc.auditeeId !== userId) {
    const error = new Error('You can submit CAPA only for your assigned NC');
    error.status = 403;
    throw error;
  }

  if (!['OPEN', 'IN_PROGRESS'].includes(nc.status)) {
    const error = new Error('CAPA can only be submitted for OPEN or IN_PROGRESS NCs');
    error.status = 409;
    throw error;
  }

  const effectiveMethod = rootCauseMethod || 'FIVE_WHY';
  if (!['FIVE_WHY', 'EIGHT_D'].includes(effectiveMethod)) {
    throw new Error('Choose FIVE_WHY or EIGHT_D');
  }

  if (effectiveMethod === 'FIVE_WHY') {
    let answers = rootCause;
    if (typeof answers === 'string') {
      try { answers = JSON.parse(answers); } catch (_) { answers = [answers]; }
    }
    if (!Array.isArray(answers) || answers.length === 0 || answers.every((a) => !String(a).trim())) {
      throw new Error('FIVE_WHY requires at least one root cause answer');
    }
  } else if (typeof rootCause !== 'string' || !rootCause.trim()) {
    throw new Error('EIGHT_D requires root cause details');
  }

  const effectiveOwnerId = ownerId || userId || nc.auditeeId;
  if (!corrective?.trim() || !preventive?.trim() || !effectiveOwnerId || !targetDate) {
    throw new Error('Corrective action, preventive action, owner and target date are required');
  }

  const parsedTargetDate = new Date(targetDate);
  if (Number.isNaN(parsedTargetDate.getTime())) {
    throw new Error('Invalid CAPA target date');
  }

  let evidence = [];
  if (Array.isArray(evidenceIds) && evidenceIds.length > 0) {
    evidence = await prisma.evidence.findMany({
      where: {
        id: { in: [...new Set(evidenceIds)] },
        uploadedById: userId
      },
      select: { id: true }
    });

    if (evidence.length !== new Set(evidenceIds).size) {
      throw new Error('Evidence is missing or does not belong to you');
    }
  }

  const rootCauseStr = typeof rootCause === 'object'
    ? JSON.stringify(rootCause)
    : String(rootCause);

  return prisma.$transaction(async (tx) => {
    const capa = await tx.capa.upsert({
      where: { ncId },
      create: {
        ncId,
        rootCauseMethod: effectiveMethod,
        rootCause: rootCauseStr,
        corrective,
        preventive,
        ownerId: effectiveOwnerId,
        targetDate: parsedTargetDate,
        ...(evidence.length > 0 ? { evidence: { connect: evidence.map((item) => ({ id: item.id })) } } : {})
      },
      update: {
        rootCauseMethod: effectiveMethod,
        rootCause: rootCauseStr,
        corrective,
        preventive,
        ownerId: effectiveOwnerId,
        targetDate: parsedTargetDate,
        ...(evidence.length > 0 ? { evidence: { set: evidence.map((item) => ({ id: item.id })) } } : {})
      }
    });

    const updatedNc = await tx.nC.update({
      where: { id: ncId },
      data: { status: 'SUBMITTED' },
      include: { line: true, capa: true, approvals: true }
    });

    if (nc.inspection?.schedule?.auditorId) {
      await tx.notification.create({
        data: {
          userId: nc.inspection.schedule.auditorId,
          channel: 'INAPP',
          title: `CAPA submitted for ${nc.ncNo}`,
          body: `The auditee has submitted a CAPA for ${nc.ncNo}. It is ready for verification.`
        }
      });
    }

    return { success: true, nc: updatedNc, capa };
  });
}

module.exports = {
  createNcsFromInspection,
  listNcs,
  getNcDetail,
  startNc,
  submitCapa,
  ncsStore,
};
