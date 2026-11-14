const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Search audit history and NC traceability records with flexible multi-criteria filtering.
 * Supports free-text query, line, shift, auditType, status, severity, and date ranges.
 */
async function searchHistory(params = {}) {
  const {
    q,
    from,
    to,
    line,
    shift,
    auditType,
    status,
    severity,
    page = 1,
    limit = 10,
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * take;

  // Build Prisma where conditions
  const where = {};

  // Date range filter
  if (from || to) {
    where.date = {};
    if (from) {
      where.date.gte = new Date(from);
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      where.date.lte = toDate;
    }
  }

  // Shift filter
  if (shift) {
    where.shift = shift.toUpperCase();
  }

  // Audit status filter
  if (status) {
    const upperStatus = status.toUpperCase();
    if (['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MISSED'].includes(upperStatus)) {
      where.status = upperStatus;
    }
  }

  // Plan level filters (line, auditType)
  const planWhere = {};
  if (auditType) {
    planWhere.auditType = auditType.toUpperCase();
  }
  if (line) {
    planWhere.line = {
      OR: [
        { id: line },
        { code: line.toUpperCase() },
        { name: { contains: line, mode: 'insensitive' } },
      ],
    };
  }
  if (Object.keys(planWhere).length > 0) {
    where.plan = planWhere;
  }

  // Severity or NC status filter
  if (severity) {
    where.inspection = {
      ncs: {
        some: {
          severity: severity.toUpperCase(),
        },
      },
    };
  }

  // Free-text fuzzy search across NCs, Line, Auditor, Product, Checklist remarks
  if (q && q.trim()) {
    const term = q.trim();
    const textConditions = [
      // Line name or code
      { plan: { line: { name: { contains: term, mode: 'insensitive' } } } },
      { plan: { line: { code: { contains: term, mode: 'insensitive' } } } },
      // Product
      { plan: { product: { contains: term, mode: 'insensitive' } } },
      // Department
      { plan: { department: { name: { contains: term, mode: 'insensitive' } } } },
      // Auditor name or email
      { auditor: { name: { contains: term, mode: 'insensitive' } } },
      { auditor: { email: { contains: term, mode: 'insensitive' } } },
      // NC Ticket Number
      {
        inspection: {
          ncs: {
            some: {
              ncNo: { contains: term, mode: 'insensitive' },
            },
          },
        },
      },
      // Inspection item remark
      {
        inspection: {
          items: {
            some: {
              remark: { contains: term, mode: 'insensitive' },
            },
          },
        },
      },
      // Checklist item description
      {
        inspection: {
          items: {
            some: {
              checklistItem: {
                itemText: { contains: term, mode: 'insensitive' },
              },
            },
          },
        },
      },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: textConditions }];
      delete where.OR;
    } else {
      where.OR = textConditions;
    }
  }

  // Query database with pagination and full relational context
  const [total, schedules] = await Promise.all([
    prisma.schedule.count({ where }),
    prisma.schedule.findMany({
      where,
      skip,
      take,
      orderBy: { date: 'desc' },
      include: {
        plan: {
          include: {
            line: true,
            department: true,
          },
        },
        auditor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        inspection: {
          include: {
            items: {
              include: {
                checklistItem: true,
                evidence: true,
              },
            },
            ncs: {
              include: {
                checklistItem: true,
                line: true,
                auditee: {
                  select: { id: true, name: true, email: true },
                },
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
                },
                evidence: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const now = new Date();

  // Format response for table display & drilldown previews
  const data = schedules.map((schedule) => {
    const inspection = schedule.inspection;
    const items = inspection?.items || [];
    const ncs = inspection?.ncs || [];

    const passCount = items.filter((i) => i.result === 'PASS').length;
    const failCount = items.filter((i) => i.result === 'FAIL').length;
    const naCount = items.filter((i) => i.result === 'NA').length;

    // Collect all evidence count across items, ncs, and capas
    let totalEvidenceCount = 0;
    items.forEach((it) => {
      totalEvidenceCount += it.evidence?.length || 0;
    });
    ncs.forEach((nc) => {
      totalEvidenceCount += nc.evidence?.length || 0;
      totalEvidenceCount += nc.capa?.evidence?.length || 0;
    });

    const formattedNcs = ncs.map((nc) => {
      const isOverdue = nc.status !== 'CLOSED' && new Date(nc.targetDate) < now;
      return {
        id: nc.id,
        ncNo: nc.ncNo,
        severity: nc.severity,
        status: nc.status,
        targetDate: nc.targetDate,
        closedAt: nc.closedAt,
        isOverdue,
        checklistItemText: nc.checklistItem?.itemText || '',
        auditee: nc.auditee?.name || 'Unassigned',
        hasCapa: !!nc.capa,
        capaStatus: nc.capa ? 'SUBMITTED' : 'PENDING',
        approvalCount: nc.approvals?.length || 0,
        isFullyApproved:
          nc.approvals?.some((a) => a.stage === 'TIER_2_QUALITY_MANAGER' && a.decision === 'APPROVED') || false,
        evidenceCount: (nc.evidence?.length || 0) + (nc.capa?.evidence?.length || 0),
      };
    });

    return {
      id: schedule.id,
      date: schedule.date,
      shift: schedule.shift,
      status: schedule.status,
      auditType: schedule.plan.auditType,
      product: schedule.plan.product,
      line: {
        id: schedule.plan.line.id,
        name: schedule.plan.line.name,
        code: schedule.plan.line.code,
      },
      department: {
        id: schedule.plan.department.id,
        name: schedule.plan.department.name,
        code: schedule.plan.department.code,
      },
      auditor: {
        id: schedule.auditor.id,
        name: schedule.auditor.name,
        email: schedule.auditor.email,
        role: schedule.auditor.role,
      },
      inspectionSummary: inspection
        ? {
            id: inspection.id,
            submittedAt: inspection.submittedAt,
            totalItems: items.length,
            passCount,
            failCount,
            naCount,
            scorePct: items.length > 0 ? Math.round((passCount / items.length) * 100) : 0,
          }
        : null,
      ncs: formattedNcs,
      ncCount: formattedNcs.length,
      hasCriticalNc: formattedNcs.some((n) => n.severity === 'CRITICAL'),
      totalEvidenceCount,
    };
  });

  // Calculate aggregation stats for current search context
  const totalNcs = data.reduce((acc, d) => acc + d.ncCount, 0);
  const openNcs = data.reduce((acc, d) => acc + d.ncs.filter((n) => n.status !== 'CLOSED').length, 0);
  const closedNcs = data.reduce((acc, d) => acc + d.ncs.filter((n) => n.status === 'CLOSED').length, 0);
  const criticalNcs = data.reduce((acc, d) => acc + d.ncs.filter((n) => n.severity === 'CRITICAL').length, 0);

  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    summary: {
      totalAudits: total,
      totalNcs,
      openNcs,
      closedNcs,
      criticalNcs,
    },
  };
}

/**
 * Fetches the comprehensive end-to-end lifecycle timeline for an audit schedule.
 * Constructs the 6-stage chronological digital audit trail:
 * 1. Plan & Schedule -> 2. Shop-Floor Inspection -> 3. NC Ticketing ->
 * 4. CAPA RCA & Containment -> 5. Two-Tier Approval Trail -> 6. Revalidation & Closure
 */
async function getAuditTimeline(scheduleId) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      plan: {
        include: {
          line: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
            },
          },
          department: true,
        },
      },
      auditor: {
        select: { id: true, name: true, email: true, role: true },
      },
      inspection: {
        include: {
          items: {
            include: {
              checklistItem: true,
              evidence: true,
            },
            orderBy: { checklistItem: { order: 'asc' } },
          },
          ncs: {
            include: {
              checklistItem: true,
              line: true,
              auditee: {
                select: { id: true, name: true, email: true, role: true },
              },
              capa: {
                include: {
                  owner: { select: { id: true, name: true, email: true } },
                  evidence: true,
                },
              },
              approvals: {
                include: {
                  byUser: { select: { id: true, name: true, role: true, email: true } },
                },
                orderBy: { createdAt: 'asc' },
              },
              evidence: true,
            },
          },
        },
      },
    },
  });

  if (!schedule) {
    return null;
  }

  const now = new Date();
  const inspection = schedule.inspection;
  const items = inspection?.items || [];
  const ncs = inspection?.ncs || [];

  // Stage 1: Plan & Schedule
  const stage1Plan = {
    stageNumber: 1,
    title: 'Audit Scheduled & Assigned',
    timestamp: schedule.createdAt,
    status: 'COMPLETED',
    details: {
      scheduleId: schedule.id,
      date: schedule.date,
      shift: schedule.shift,
      auditType: schedule.plan.auditType,
      product: schedule.plan.product,
      line: {
        name: schedule.plan.line.name,
        code: schedule.plan.line.code,
        owner: schedule.plan.line.owner?.name,
      },
      department: schedule.plan.department.name,
      auditor: schedule.auditor,
    },
  };

  // Stage 2: Shop-floor Inspection
  const stage2Inspection = {
    stageNumber: 2,
    title: 'Shop-Floor Inspection Executed',
    timestamp: inspection?.submittedAt || null,
    status: inspection ? 'COMPLETED' : schedule.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PENDING',
    details: inspection
      ? {
          inspectionId: inspection.id,
          submittedAt: inspection.submittedAt,
          totalChecked: items.length,
          passCount: items.filter((i) => i.result === 'PASS').length,
          failCount: items.filter((i) => i.result === 'FAIL').length,
          naCount: items.filter((i) => i.result === 'NA').length,
          items: items.map((item) => ({
            id: item.id,
            section: item.checklistItem?.section || 'General',
            itemText: item.checklistItem?.itemText || '',
            result: item.result,
            severity: item.severity,
            remark: item.remark,
            evidence: item.evidence.map((ev) => ({
              id: ev.id,
              fileName: ev.fileName,
              url: ev.url,
            })),
          })),
        }
      : null,
  };

  // Stage 3: NCs Raised
  const stage3Ncs = {
    stageNumber: 3,
    title: `Non-Conformance Ticketing (${ncs.length} Raised)`,
    timestamp: ncs.length > 0 ? ncs[0].createdAt : null,
    status: ncs.length > 0 ? 'COMPLETED' : inspection ? 'PASSED_CLEAN' : 'PENDING',
    ncs: ncs.map((nc) => {
      const isOverdue = nc.status !== 'CLOSED' && new Date(nc.targetDate) < now;
      return {
        id: nc.id,
        ncNo: nc.ncNo,
        severity: nc.severity,
        status: nc.status,
        checklistItemText: nc.checklistItem?.itemText,
        auditee: nc.auditee,
        targetDate: nc.targetDate,
        createdAt: nc.createdAt,
        closedAt: nc.closedAt,
        isOverdue,
        evidence: nc.evidence.map((ev) => ({
          id: ev.id,
          fileName: ev.fileName,
          url: ev.url,
        })),
      };
    }),
  };

  // Stage 4: CAPA RCA & Containment
  const ncsWithCapa = ncs.filter((n) => n.capa);
  const stage4Capa = {
    stageNumber: 4,
    title: `CAPA Root-Cause Analysis (${ncsWithCapa.length}/${ncs.length} Filed)`,
    status:
      ncs.length === 0
        ? 'NOT_APPLICABLE'
        : ncsWithCapa.length === ncs.length
        ? 'COMPLETED'
        : ncsWithCapa.length > 0
        ? 'PARTIALLY_SUBMITTED'
        : 'PENDING',
    capas: ncsWithCapa.map((nc) => ({
      ncNo: nc.ncNo,
      ncId: nc.id,
      capaId: nc.capa.id,
      method: nc.capa.rootCauseMethod,
      rootCause: nc.capa.rootCause,
      corrective: nc.capa.corrective,
      preventive: nc.capa.preventive,
      owner: nc.capa.owner,
      targetDate: nc.capa.targetDate,
      submittedAt: nc.capa.submittedAt,
      evidence: nc.capa.evidence.map((ev) => ({
        id: ev.id,
        fileName: ev.fileName,
        url: ev.url,
      })),
    })),
  };

  // Stage 5: Two-Tier Verification & Approvals
  const allApprovals = [];
  ncs.forEach((nc) => {
    (nc.approvals || []).forEach((appr) => {
      allApprovals.push({
        ncNo: nc.ncNo,
        stage: appr.stage,
        decision: appr.decision,
        remark: appr.remark,
        byUser: appr.byUser,
        decidedAt: appr.createdAt,
      });
    });
  });

  const tier1Count = allApprovals.filter((a) => a.stage === 'TIER_1_LINE_SUPERVISOR' && a.decision === 'APPROVED').length;
  const tier2Count = allApprovals.filter((a) => a.stage === 'TIER_2_QUALITY_MANAGER' && a.decision === 'APPROVED').length;

  const stage5Approvals = {
    stageNumber: 5,
    title: 'Two-Tier Verification & Approvals',
    status:
      ncs.length === 0
        ? 'NOT_APPLICABLE'
        : tier2Count >= ncs.length && ncs.length > 0
        ? 'FULLY_APPROVED'
        : tier1Count > 0
        ? 'TIER_1_SIGNED'
        : 'PENDING_APPROVAL',
    tier1Signoffs: tier1Count,
    tier2Signoffs: tier2Count,
    requiredCount: ncs.length,
    approvalsList: allApprovals,
  };

  // Stage 6: Revalidation & Final Closure
  const closedNcs = ncs.filter((n) => n.status === 'CLOSED');
  const allClosed = ncs.length > 0 && closedNcs.length === ncs.length;
  const latestClose = closedNcs.reduce((latest, n) => {
    if (!latest || new Date(n.closedAt) > new Date(latest)) return n.closedAt;
    return latest;
  }, null);

  const stage6Closure = {
    stageNumber: 6,
    title: 'Audit Revalidation & Compliance Sign-Off',
    status:
      ncs.length === 0 && inspection
        ? 'CLEAN_PASS_COMPLETED'
        : allClosed
        ? 'CLOSED_AND_VERIFIED'
        : 'OPEN_ACTIONS_PENDING',
    closedCount: closedNcs.length,
    totalNcs: ncs.length,
    closedAt: latestClose,
    isFullyCompliant: (ncs.length === 0 && !!inspection) || allClosed,
  };

  return {
    scheduleId: schedule.id,
    scheduleDate: schedule.date,
    shift: schedule.shift,
    status: schedule.status,
    line: schedule.plan.line,
    department: schedule.plan.department,
    product: schedule.plan.product,
    auditor: schedule.auditor,
    timeline: [
      stage1Plan,
      stage2Inspection,
      stage3Ncs,
      stage4Capa,
      stage5Approvals,
      stage6Closure,
    ],
  };
}

/**
 * Find full timeline directly from an NC ID or Ticket Number
 */
async function getNcTimeline(ncIdOrNo) {
  const nc = await prisma.nC.findFirst({
    where: {
      OR: [{ id: ncIdOrNo }, { ncNo: ncIdOrNo }],
    },
    include: {
      inspection: true,
    },
  });

  if (!nc || !nc.inspection?.scheduleId) {
    return null;
  }

  const timeline = await getAuditTimeline(nc.inspection.scheduleId);
  return {
    targetNcId: nc.id,
    targetNcNo: nc.ncNo,
    ...timeline,
  };
}

module.exports = {
  searchHistory,
  getAuditTimeline,
  getNcTimeline,
};
