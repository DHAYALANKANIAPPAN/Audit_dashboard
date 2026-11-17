const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const approvalInclude = {
  byUser: { select: { id: true, name: true, role: true } },
};

async function getPendingApprovals({ role, userId } = {}) {
  const auditorScope = role === 'AUDITOR'
    ? { inspection: { schedule: { auditorId: userId } } }
    : {};

  const tier1Pending = role === 'AUDIT_HEAD'
    ? []
    : await prisma.nC.findMany({
        where: { status: 'SUBMITTED', ...auditorScope },
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

  const tier2Pending = role === 'AUDITOR'
    ? []
    : await prisma.nC.findMany({
        where: { status: 'VERIFIED' },
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
            include: approvalInclude,
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

async function decideApproval(ncId, { stage, decision, remark, userId, userRole }) {
  if (!userId || !userRole) {
    throw new Error('Authenticated user is required');
  }

  if (!['ACCEPT', 'REJECT'].includes(decision)) {
    throw new Error('Decision must be ACCEPT or REJECT');
  }

  if (decision === 'REJECT' && (!remark || !remark.trim())) {
    throw new Error('A remark is required when rejecting an NC');
  }

  const expectedRole = stage === 'AUDITOR_VERIFY'
    ? 'AUDITOR'
    : stage === 'HEAD_SIGNOFF'
      ? 'AUDIT_HEAD'
      : null;

  if (!expectedRole || userRole !== expectedRole) {
    throw new Error('You are not authorized for this approval stage');
  }

  return prisma.$transaction(async (tx) => {
    const nc = await tx.nC.findUnique({
      where: { id: ncId },
      include: { approvals: true },
    });

    if (!nc) throw new Error(`NC '${ncId}' not found`);

    if (stage === 'AUDITOR_VERIFY' && nc.status !== 'SUBMITTED') {
      throw new Error('Only SUBMITTED NCs can be verified by an auditor');
    }

    if (stage === 'HEAD_SIGNOFF' && nc.status !== 'VERIFIED') {
      throw new Error('Only VERIFIED NCs can be signed off by the audit head');
    }

    if (stage === 'AUDITOR_VERIFY') {
      const inspection = await tx.inspection.findUnique({
        where: { id: nc.inspectionId },
        include: { schedule: true },
      });

      if (inspection?.schedule?.auditorId !== userId) {
        throw new Error('Only the auditor who conducted this inspection can verify this NC');
      }
    }

    const nextStatus = decision === 'REJECT'
      ? 'IN_PROGRESS'
      : stage === 'AUDITOR_VERIFY'
        ? 'VERIFIED'
        : 'CLOSED';

    const approval = await tx.approval.create({
      data: {
        ncId,
        stage,
        decision,
        remark: remark?.trim() || null,
        byUserId: userId,
      },
      include: approvalInclude,
    });

    const updatedNc = await tx.nC.update({
      where: { id: ncId },
      data: {
        status: nextStatus,
        closedAt: nextStatus === 'CLOSED' ? new Date() : null,
      },
      include: {
        line: true,
        auditee: { select: { id: true, name: true, email: true } },
        approvals: {
          include: approvalInclude,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await tx.notification.create({
      data: {
        userId: nc.auditeeId,
        channel: 'INAPP',
        title: decision === 'REJECT'
          ? `NC ${nc.ncNo} requires further action`
          : nextStatus === 'CLOSED'
            ? `NC ${nc.ncNo} closed`
            : `NC ${nc.ncNo} verified`,
        body: decision === 'REJECT'
          ? `Your NC was rejected. Remark: ${remark.trim()}`
          : nextStatus === 'CLOSED'
            ? 'The audit head approved and closed this NC.'
            : 'The auditor verified your CAPA. It is awaiting audit-head sign-off.',
      },
    });

    return { success: true, approval, nc: updatedNc };
  });
}

module.exports = { getPendingApprovals, decideApproval };
