const { PrismaClient } = require('@prisma/client');
const { createNcsFromInspection } = require('../nc/service');

const prisma = new PrismaClient();

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function startSchedule(scheduleId, currentUser) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId }
  });

  if (!schedule) {
    throw httpError('Schedule not found', 404, 'NOT_FOUND');
  }

  if (schedule.auditorId !== currentUser.id) {
    throw httpError('Only the assigned auditor can start this schedule', 403, 'FORBIDDEN');
  }

  if (schedule.status === 'DONE') {
    throw httpError('Schedule is already completed', 409, 'CONFLICT');
  }

  if (schedule.status === 'IN_PROGRESS') {
    return { schedule, idempotent: true };
  }

  const updated = await prisma.schedule.update({
    where: { id: scheduleId },
    data: { status: 'IN_PROGRESS' }
  });

  return { schedule: updated, idempotent: false };
}

async function createInspection({ clientId, scheduleId, items }, currentUser) {
  if (!currentUser?.id) {
    throw httpError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Return the existing submission for an idempotent retry.
  const existing = await prisma.inspection.findUnique({
    where: { clientId },
    include: { items: { include: { evidence: true } }, ncs: true }
  });

  if (existing) {
    return {
      inspection: existing,
      ncs: existing.ncs,
      isDuplicate: true
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          plan: {
            include: {
              line: {
                include: { owner: true }
              }
            }
          }
        }
      });

      if (!schedule) {
        throw httpError('Schedule not found', 404, 'NOT_FOUND');
      }

      if (schedule.auditorId !== currentUser.id) {
        throw httpError('Only the assigned auditor can submit this inspection', 403, 'FORBIDDEN');
      }

      if (schedule.status === 'DONE' || schedule.status === 'MISSED') {
        throw httpError('This schedule cannot accept an inspection', 409, 'CONFLICT');
      }

      const evidenceIds = [...new Set(items.flatMap((item) => item.evidenceIds || []))];

      if (evidenceIds.length) {
        const evidence = await tx.evidence.findMany({
          where: {
            id: { in: evidenceIds },
            uploadedById: currentUser.id
          },
          select: { id: true }
        });

        if (evidence.length !== evidenceIds.length) {
          throw httpError(
            'One or more evidence records are missing or do not belong to this auditor',
            400,
            'INVALID_EVIDENCE'
          );
        }
      }

      const inspection = await tx.inspection.create({
        data: {
          clientId,
          scheduleId,
          items: {
            create: items.map((item) => ({
              checklistItemId: item.checklistItemId,
              result: item.result,
              severity: item.result === 'FAIL' ? item.severity : null,
              remark: item.remark || '',
              ...(item.evidenceIds?.length
                ? {
                    evidence: {
                      connect: item.evidenceIds.map((id) => ({ id }))
                    }
                  }
                : {})
            }))
          }
        },
        include: {
          items: { include: { evidence: true } },
          schedule: true
        }
      });

      const ncs = await createNcsFromInspection(
        inspection,
        tx,
        schedule
      );

      await tx.schedule.update({
        where: { id: scheduleId },
        data: { status: 'DONE' }
      });

      return {
        inspection,
        ncs,
        isDuplicate: false
      };
    });
  } catch (error) {
    // Handle a simultaneous retry with the same clientId.
    if (error.code === 'P2002') {
      const duplicate = await prisma.inspection.findUnique({
        where: { clientId },
        include: { items: { include: { evidence: true } }, ncs: true }
      });

      if (duplicate) {
        return {
          inspection: duplicate,
          ncs: duplicate.ncs,
          isDuplicate: true
        };
      }
    }

    throw error;
  }
}

async function getInspectionById(id) {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          checklistItem: true,
          evidence: true
        }
      },
      ncs: true,
      schedule: {
        include: {
          auditor: { select: { id: true, name: true, email: true } },
          plan: { include: { line: true } }
        }
      }
    }
  });

  if (!inspection) {
    throw httpError('Inspection not found', 404, 'NOT_FOUND');
  }

  return inspection;
}

async function getSchedulesByAuditor(auditorId) {
  return prisma.schedule.findMany({
    where: { auditorId },
    orderBy: { date: 'asc' },
    include: {
      plan: { include: { line: true } },
      inspection: true
    }
  });
}

module.exports = {
  startSchedule,
  createInspection,
  getInspectionById,
  getSchedulesByAuditor
};
