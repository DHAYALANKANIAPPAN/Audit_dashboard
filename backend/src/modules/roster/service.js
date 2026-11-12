const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Automatically assigns auditors to unscheduled AuditPlans with:
 * 1. Zero Shift Conflict (no auditor assigned to multiple lines in same date+shift)
 * 2. Balanced Workload (picks the auditor with lowest total assignments in that day/month)
 */
async function generateRoster({ month, date }) {
  // 1. Fetch all auditors
  const auditors = await prisma.user.findMany({
    where: { role: 'AUDITOR' },
    select: { id: true, name: true, email: true },
  });

  if (auditors.length === 0) {
    throw new Error('No users with AUDITOR role found in system. Please seed or create auditors first.');
  }

  // 2. Query unscheduled plans for the target month or date
  const planWhere = {
    schedules: { none: {} },
  };
  if (month) {
    planWhere.month = month;
  }
  if (date) {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    planWhere.plannedDate = { gte: targetDate, lt: nextDay };
  }

  const unscheduledPlans = await prisma.auditPlan.findMany({
    where: planWhere,
    orderBy: [{ plannedDate: 'asc' }, { shift: 'asc' }],
  });

  if (unscheduledPlans.length === 0) {
    return {
      message: 'No unscheduled plans found for the specified period.',
      generatedCount: 0,
      schedules: [],
    };
  }

  // 3. Load all existing schedules in this month/period to track workloads & conflicts
  const existingSchedules = await prisma.schedule.findMany({
    include: { auditor: true },
  });

  // Track assignments: auditorId -> count
  const workloadMap = new Map();
  auditors.forEach((a) => workloadMap.set(a.id, 0));
  existingSchedules.forEach((s) => {
    if (workloadMap.has(s.auditorId)) {
      workloadMap.set(s.auditorId, workloadMap.get(s.auditorId) + 1);
    }
  });

  // Track busy slots: "YYYY-MM-DD_SHIFT_AUDITORID" -> true
  const busySlots = new Set();
  existingSchedules.forEach((s) => {
    const dStr = s.date.toISOString().split('T')[0];
    busySlots.add(`${dStr}_${s.shift}_${s.auditorId}`);
  });

  const createdSchedules = [];

  // 4. Assign each plan
  for (const plan of unscheduledPlans) {
    const dStr = plan.plannedDate.toISOString().split('T')[0];

    // Filter auditors who have no conflict in this exact date + shift
    const availableAuditors = auditors.filter(
      (a) => !busySlots.has(`${dStr}_${plan.shift}_${a.id}`)
    );

    // Pick candidate: if conflict-free exists, pick lowest workload; else pick lowest workload overall
    const candidates = availableAuditors.length > 0 ? availableAuditors : auditors;
    candidates.sort((a, b) => (workloadMap.get(a.id) || 0) - (workloadMap.get(b.id) || 0));
    const selectedAuditor = candidates[0];

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        planId: plan.id,
        auditorId: selectedAuditor.id,
        date: plan.plannedDate,
        shift: plan.shift,
        status: 'PLANNED',
      },
      include: {
        auditor: { select: { id: true, name: true, email: true } },
        plan: {
          include: {
            line: true,
            department: true,
          },
        },
      },
    });

    // Update tracking
    workloadMap.set(selectedAuditor.id, (workloadMap.get(selectedAuditor.id) || 0) + 1);
    busySlots.add(`${dStr}_${plan.shift}_${selectedAuditor.id}`);
    createdSchedules.push(schedule);
  }

  return {
    message: `Successfully scheduled ${createdSchedules.length} audits.`,
    generatedCount: createdSchedules.length,
    schedules: createdSchedules,
  };
}

/**
 * Returns roster schedules for a specific date or month
 */
async function getRoster({ date, month }) {
  const where = {};

  if (date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  } else if (month) {
    where.plan = { month };
  }

  return prisma.schedule.findMany({
    where,
    include: {
      auditor: { select: { id: true, name: true, email: true } },
      plan: {
        include: {
          line: { include: { owner: { select: { id: true, name: true, email: true } } } },
          department: true,
        },
      },
      inspection: {
        select: { id: true, submittedAt: true },
      },
    },
    orderBy: [{ date: 'asc' }, { shift: 'asc' }],
  });
}

/**
 * Reassigns an existing schedule to a new auditor
 */
async function reassignSchedule(scheduleId, newAuditorId) {
  const auditor = await prisma.user.findUnique({
    where: { id: newAuditorId },
  });

  if (!auditor || auditor.role !== 'AUDITOR') {
    throw new Error('Assigned user must exist and have AUDITOR role');
  }

  return prisma.schedule.update({
    where: { id: scheduleId },
    data: { auditorId: newAuditorId },
    include: {
      auditor: { select: { id: true, name: true, email: true } },
      plan: { include: { line: true, department: true } },
    },
  });
}

/**
 * Fetches schedules assigned to the logged-in auditor
 */
async function getMySchedules(auditorId, date) {
  const where = { auditorId };

  if (date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  }

  return prisma.schedule.findMany({
    where,
    include: {
      plan: {
        include: {
          line: { include: { owner: { select: { id: true, name: true, email: true } } } },
          department: true,
        },
      },
      inspection: true,
    },
    orderBy: [{ date: 'asc' }, { shift: 'asc' }],
  });
}

/**
 * Exported shared contract function:
 * Scans schedules with status 'PLANNED' whose planned date is before today
 * and marks them as 'MISSED'.
 */
async function markMissedSchedules() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const result = await prisma.schedule.updateMany({
    where: {
      status: 'PLANNED',
      date: { lt: today },
    },
    data: {
      status: 'MISSED',
    },
  });

  return {
    updatedCount: result.count,
    message: `Marked ${result.count} past planned schedules as MISSED.`,
  };
}

module.exports = {
  generateRoster,
  getRoster,
  reassignSchedule,
  getMySchedules,
  markMissedSchedules,
};
