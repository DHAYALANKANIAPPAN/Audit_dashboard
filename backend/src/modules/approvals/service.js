const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Get all pending approvals segregated by Tier 1 (Auditor Verification) and Tier 2 (Quality Head Sign-off)
 */
async function getPendingApprovals() {
  // Pending Tier 1: NCs with status 'SUBMITTED' (CAPA submitted, awaiting auditor verification)
  const tier1Pending = await prisma.nC.findMany({
    where: {
      status: 'SUBMITTED',
    },
    include: {
      line: true,
      auditee: { select: { id: true, name: true, email: true } },
      checklistItem: true,
      capa: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
          evidence: true,
        },
      },
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
    orderBy: { targetDate: 'asc' },
  });

  // Pending Tier 2: NCs with status 'VERIFIED' (Auditor approved, awaiting Audit Head sign-off)
  const tier2Pending = await prisma.nC.findMany({
    where: {
      status: 'VERIFIED',
    },
    include: {
      line: true,
      auditee: { select: { id: true, name: true, email: true } },
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
    orderBy: { targetDate: 'asc' },
  });

  return {
    tier1: tier1Pending,
    tier2: tier2Pending,
    counts: {
      tier1Count: tier1Pending.length,
      tier2Count: tier2Pending.length,
      totalPending: tier1Pending.length + tier2Pending.length,
    },
  };
}

/**
 * Submit an approval decision (Tier 1 AUDITOR_VERIFY or Tier 2 HEAD_SIGNOFF)
 */
async function decideApproval(ncId, { stage, decision, remark, userId }) {
  const nc = await prisma.nC.findUnique({
    where: { id: ncId },
    include: { approvals: true },
  });

  if (!nc) {
    throw new Error(`NC ticket '${ncId}' not found.`);
  }

  // Fallback user if userId not provided
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const defaultUser = await prisma.user.findFirst({
      where: stage === 'HEAD_SIGNOFF' ? { role: 'AUDIT_HEAD' } : { role: 'AUDITOR' },
    });
    effectiveUserId = defaultUser?.id || 'usr-auditor-1';
  }

  const approvalStage = stage === 'HEAD_SIGNOFF' ? 'HEAD_SIGNOFF' : 'AUDITOR_VERIFY';
  const approvalDecision = decision === 'REJECT' ? 'REJECT' : 'ACCEPT';

  // 1. Record Approval
  const approval = await prisma.approval.create({
    data: {
      ncId,
      stage: approvalStage,
      decision: approvalDecision,
      remark: remark || (approvalDecision === 'ACCEPT' ? 'Approved & verified on-site.' : 'Rejected. Further action required.'),
      byUserId: effectiveUserId,
    },
    include: {
      byUser: { select: { id: true, name: true, role: true } },
    },
  });

  // 2. Transition NC Status
  let nextStatus = nc.status;
  let closedAt = null;

  if (approvalStage === 'AUDITOR_VERIFY') {
    if (approvalDecision === 'ACCEPT') {
      nextStatus = 'VERIFIED';
    } else {
      nextStatus = 'IN_PROGRESS'; // Send back for correction
    }
  } else if (approvalStage === 'HEAD_SIGNOFF') {
    if (approvalDecision === 'ACCEPT') {
      nextStatus = 'CLOSED';
      closedAt = new Date();
    } else {
      nextStatus = 'SUBMITTED'; // Send back to auditor
    }
  }

  const updatedNc = await prisma.nC.update({
    where: { id: ncId },
    data: {
      status: nextStatus,
      closedAt,
    },
    include: {
      line: true,
      approvals: {
        include: { byUser: true },
      },
    },
  });

  return {
    success: true,
    approval,
    nc: updatedNc,
  };
}

module.exports = {
  getPendingApprovals,
  decideApproval,
};
