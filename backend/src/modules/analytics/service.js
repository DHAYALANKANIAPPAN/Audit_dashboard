const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Calculates all executive quality KPIs and operational analytics from PostgreSQL.
 * Filters supported: from, to, line, shift, department
 */
async function getAnalyticsSummary(filters = {}) {
  const { from, to, line, shift, department } = filters;
  const now = new Date();

  // Date filters
  const dateFilter = {};
  if (from) {
    dateFilter.gte = new Date(from);
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setUTCHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }

  // Schedule where clause
  const scheduleWhere = {};
  if (from || to) {
    scheduleWhere.date = dateFilter;
  }
  if (shift) {
    scheduleWhere.shift = shift.toUpperCase();
  }
  if (line || department) {
    scheduleWhere.plan = {};
    if (line) {
      scheduleWhere.plan.line = {
        OR: [{ id: line }, { code: line.toUpperCase() }, { name: { contains: line, mode: 'insensitive' } }],
      };
    }
    if (department) {
      scheduleWhere.plan.department = {
        OR: [{ id: department }, { code: department.toUpperCase() }, { name: { contains: department, mode: 'insensitive' } }],
      };
    }
  }

  // NC where clause
  const ncWhere = {};
  if (from || to) {
    ncWhere.createdAt = dateFilter;
  }
  if (line) {
    ncWhere.line = {
      OR: [{ id: line }, { code: line.toUpperCase() }, { name: { contains: line, mode: 'insensitive' } }],
    };
  }

  // ==========================================================
  // 1. COMPLETION RATE METRIC
  // Definition: Audit Completion % = (executed / planned) * 100
  // Executed = schedules with status 'DONE'
  // Planned = all schedules
  // ==========================================================
  const allSchedules = await prisma.schedule.findMany({
    where: scheduleWhere,
    include: {
      plan: {
        include: { line: true, department: true },
      },
      auditor: true,
    },
  });

  const totalPlannedSchedules = allSchedules.length;
  const executedSchedules = allSchedules.filter((s) => s.status === 'DONE').length;
  const completionPercent =
    totalPlannedSchedules > 0
      ? Number(((executedSchedules / totalPlannedSchedules) * 100).toFixed(1))
      : 0;

  // Breakdown by Line
  const lineStatsMap = new Map();
  allSchedules.forEach((s) => {
    const lineName = s.plan?.line?.name || 'Unknown Line';
    if (!lineStatsMap.has(lineName)) {
      lineStatsMap.set(lineName, { line: lineName, planned: 0, executed: 0 });
    }
    const stat = lineStatsMap.get(lineName);
    stat.planned += 1;
    if (s.status === 'DONE') stat.executed += 1;
  });
  const byLine = Array.from(lineStatsMap.values()).map((l) => ({
    ...l,
    percent: l.planned > 0 ? Number(((l.executed / l.planned) * 100).toFixed(1)) : 0,
  }));

  // Breakdown by Shift
  const shiftStatsMap = {
    A: { shift: 'A', planned: 0, executed: 0 },
    B: { shift: 'B', planned: 0, executed: 0 },
    C: { shift: 'C', planned: 0, executed: 0 },
  };
  allSchedules.forEach((s) => {
    if (shiftStatsMap[s.shift]) {
      shiftStatsMap[s.shift].planned += 1;
      if (s.status === 'DONE') shiftStatsMap[s.shift].executed += 1;
    }
  });
  const byShift = Object.values(shiftStatsMap);

  // Breakdown by Department
  const deptStatsMap = new Map();
  allSchedules.forEach((s) => {
    const deptName = s.plan?.department?.name || 'Unknown Department';
    if (!deptStatsMap.has(deptName)) {
      deptStatsMap.set(deptName, { department: deptName, planned: 0, executed: 0 });
    }
    const stat = deptStatsMap.get(deptName);
    stat.planned += 1;
    if (s.status === 'DONE') stat.executed += 1;
  });
  const byDepartment = Array.from(deptStatsMap.values());

  // ==========================================================
  // 2. NC COUNTS & OVERDUE CALCULATION
  // Definition: Overdue is NOT a database status.
  // Overdue = status !== 'CLOSED' && targetDate < now
  // ==========================================================
  const allNcs = await prisma.nC.findMany({
    where: ncWhere,
    include: {
      line: true,
      checklistItem: true,
      approvals: true,
      capa: true,
    },
  });

  const totalNcs = allNcs.length;
  let openCount = 0;
  let inProgressCount = 0;
  let overdueCount = 0;
  let closedCount = 0;

  allNcs.forEach((nc) => {
    const isClosed = nc.status === 'CLOSED';
    const isOverdue = !isClosed && new Date(nc.targetDate) < now;

    if (isOverdue) overdueCount += 1;
    if (nc.status === 'OPEN') openCount += 1;
    if (nc.status === 'IN_PROGRESS' || nc.status === 'SUBMITTED' || nc.status === 'VERIFIED') {
      inProgressCount += 1;
    }
    if (isClosed) closedCount += 1;
  });

  // ==========================================================
  // 3. ON-TIME CLOSURE % & MTTC (Mean Time to Close)
  // Definition: On-Time Closure % = (closed on or before targetDate / total closed) * 100
  // MTTC = average (closedAt - createdAt) in days for closed NCs
  // ==========================================================
  const closedNcs = allNcs.filter((n) => n.status === 'CLOSED' && n.closedAt);
  let closedOnTime = 0;
  let totalClosureDays = 0;

  closedNcs.forEach((nc) => {
    const closedDate = new Date(nc.closedAt);
    const targetDate = new Date(nc.targetDate);
    const createdDate = new Date(nc.createdAt);

    if (closedDate <= targetDate) {
      closedOnTime += 1;
    }

    const durationDays = Math.max(0, (closedDate - createdDate) / (1000 * 60 * 60 * 24));
    totalClosureDays += durationDays;
  });

  const totalClosed = closedNcs.length;
  const onTimePercent =
    totalClosed > 0
      ? Number(((closedOnTime / totalClosed) * 100).toFixed(1))
      : 0;

  const mttcDays =
    totalClosed > 0
      ? Number((totalClosureDays / totalClosed).toFixed(1))
      : 0;

  // ==========================================================
  // 4. AGING BUCKETS (Open NCs only, based on now - createdAt)
  // Buckets: under 7 days (<7), 7-15 days, 15-30 days, over 30 days (>30)
  // ==========================================================
  const aging = {
    lt7: 0,
    d7to15: 0,
    d15to30: 0,
    gt30: 0,
  };

  const activeNcs = allNcs.filter((n) => n.status !== 'CLOSED');
  activeNcs.forEach((nc) => {
    const ageDays = (now - new Date(nc.createdAt)) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      aging.lt7 += 1;
    } else if (ageDays <= 15) {
      aging.d7to15 += 1;
    } else if (ageDays <= 30) {
      aging.d15to30 += 1;
    } else {
      aging.gt30 += 1;
    }
  });

  // ==========================================================
  // 5. PENDING APPROVALS
  // Verification: NC status SUBMITTED (CAPA ready, awaiting auditor verification)
  // Head Sign-off: NC status VERIFIED (verified by auditor, awaiting Head close)
  // ==========================================================
  const pendingApprovals = {
    verification: allNcs.filter((n) => n.status === 'SUBMITTED').length,
    headSignoff: allNcs.filter((n) => n.status === 'VERIFIED').length,
  };

  // ==========================================================
  // 6. AUDITOR WORKLOAD & RECURRING FAILURES
  // ==========================================================
  const auditorWorkloadMap = new Map();
  allSchedules.forEach((s) => {
    const name = s.auditor?.name || 'Unassigned';
    if (!auditorWorkloadMap.has(name)) {
      auditorWorkloadMap.set(name, { auditor: name, planned: 0, done: 0 });
    }
    const w = auditorWorkloadMap.get(name);
    w.planned += 1;
    if (s.status === 'DONE') w.done += 1;
  });
  const auditorWorkload = Array.from(auditorWorkloadMap.values());

  // Recurring Failures (group by checklist item & line)
  const failureCountMap = new Map();
  allNcs.forEach((nc) => {
    const itemText = nc.checklistItem?.itemText || 'Checklist Item';
    const lineName = nc.line?.name || 'Production Line';
    const key = `${itemText}|||${lineName}`;

    if (!failureCountMap.has(key)) {
      failureCountMap.set(key, { item: itemText, line: lineName, count: 0 });
    }
    failureCountMap.get(key).count += 1;
  });

  const recurringFailures = Array.from(failureCountMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    completion: {
      planned: totalPlannedSchedules,
      executed: executedSchedules,
      percent: completionPercent,
      byLine,
      byShift,
      byDepartment,
    },
    nc: {
      open: openCount,
      inProgress: inProgressCount,
      overdue: overdueCount,
      closed: closedCount,
      total: totalNcs,
    },
    onTimeClosure: {
      closedOnTime,
      totalClosed,
      percent: onTimePercent,
    },
    mttcDays,
    aging,
    pendingApprovals,
    auditorWorkload,
    recurringFailures,
  };
}

module.exports = {
  getAnalyticsSummary,
};
