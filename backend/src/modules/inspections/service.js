const { createNcsFromInspection } = require('../nc/service');

// In-memory data stores
const inspectionsStore = new Map(); // id -> inspection
const clientIdIndex = new Map();    // clientId -> { inspection, ncs }
const schedulesStore = new Map();   // id -> schedule

// Seed initial schedules from data contract
const INITIAL_SCHEDULES = [
  {
    id: 'sched-101',
    planId: 'plan-01',
    auditorId: 'usr-bhava',
    date: new Date().toISOString().split('T')[0],
    shift: 'A',
    status: 'PLANNED',
    auditType: 'PRODUCT',
    line: 'Line 1 - Engine Assembly',
    department: 'Assembly',
    product: 'V6 Turbo Engine Block'
  },
  {
    id: 'sched-102',
    planId: 'plan-02',
    auditorId: 'usr-bhava',
    date: new Date().toISOString().split('T')[0],
    shift: 'B',
    status: 'IN_PROGRESS',
    auditType: 'REVALIDATION',
    line: 'Line 3 - Paint & Coating',
    department: 'Paint',
    product: 'Chassis Primer Coating'
  },
  {
    id: 'sched-103',
    planId: 'plan-03',
    auditorId: 'usr-bhava',
    date: new Date().toISOString().split('T')[0],
    shift: 'C',
    status: 'DONE',
    auditType: 'PRODUCT',
    line: 'Line 2 - Transmission',
    department: 'Machining',
    product: 'Gearbox Housing Casing'
  }
];

// Initialize seed data
INITIAL_SCHEDULES.forEach((sched) => schedulesStore.set(sched.id, { ...sched }));

/**
 * Start a scheduled audit (moves status from PLANNED to IN_PROGRESS)
 */
function startSchedule(scheduleId, currentUser = { id: 'usr-bhava' }) {
  const schedule = schedulesStore.get(scheduleId);

  if (!schedule) {
    const error = new Error(`Schedule '${scheduleId}' not found`);
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 409 Conflict if already DONE
  if (schedule.status === 'DONE') {
    const error = new Error(`Schedule '${scheduleId}' is already marked as DONE and cannot be restarted`);
    error.status = 409;
    error.code = 'CONFLICT';
    throw error;
  }

  // Auditor authorization check
  if (currentUser && currentUser.id && schedule.auditorId !== currentUser.id) {
    const error = new Error(`Unauthorized: Only assigned auditor '${schedule.auditorId}' can start this schedule`);
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  // Idempotent: if already IN_PROGRESS, return current schedule
  if (schedule.status === 'IN_PROGRESS') {
    return { schedule, idempotent: true };
  }

  // Update status to IN_PROGRESS
  schedule.status = 'IN_PROGRESS';
  schedule.startedAt = new Date().toISOString();
  schedulesStore.set(scheduleId, schedule);

  return { schedule, idempotent: false };
}

/**
 * Creates an inspection with idempotency and auto-raises NC tickets
 */
function createInspection({ clientId, scheduleId, items }, currentUser = { id: 'usr-bhava' }) {
  // IDEMPOTENCY CHECK
  if (clientIdIndex.has(clientId)) {
    const existing = clientIdIndex.get(clientId);
    return {
      inspection: existing.inspection,
      ncs: existing.ncs,
      isDuplicate: true
    };
  }

  // Verify schedule exists
  const schedule = schedulesStore.get(scheduleId);
  if (!schedule) {
    const error = new Error(`Schedule '${scheduleId}' not found`);
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // Transaction: Save inspection + items, update schedule to DONE
  const now = new Date();
  const inspectionId = `insp-${Date.now()}`;

  const inspectionRecord = {
    id: inspectionId,
    clientId,
    scheduleId,
    submittedAt: now.toISOString(),
    auditorId: currentUser?.id || schedule.auditorId || 'usr-bhava',
    line: schedule.line,
    department: schedule.department,
    product: schedule.product,
    auditType: schedule.auditType,
    shift: schedule.shift,
    items: items.map((item, idx) => ({
      id: `insp-item-${Date.now()}-${idx + 1}`,
      inspectionId,
      checklistItemId: item.checklistItemId,
      result: item.result,
      severity: item.result === 'FAIL' ? item.severity : null,
      remark: item.result === 'FAIL' ? (item.remark || '').trim() : '',
      evidenceIds: item.evidenceIds || []
    }))
  };

  // Atomically mark schedule as DONE
  schedule.status = 'DONE';
  schedule.completedAt = now.toISOString();
  schedulesStore.set(scheduleId, schedule);

  // Save inspection
  inspectionsStore.set(inspectionId, inspectionRecord);

  // Auto-raise NCs via Linga's contract function
  const ncs = createNcsFromInspection(inspectionRecord);

  // Cache by clientId for idempotent replay
  const result = {
    inspection: inspectionRecord,
    ncs,
    isDuplicate: false
  };
  clientIdIndex.set(clientId, result);

  return result;
}

/**
 * Retrieve inspection by ID
 */
function getInspectionById(id) {
  const inspection = inspectionsStore.get(id);
  if (!inspection) {
    const error = new Error(`Inspection '${id}' not found`);
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return inspection;
}

/**
 * List schedules assigned to an auditor
 */
function getSchedulesByAuditor(auditorId = 'usr-bhava') {
  return Array.from(schedulesStore.values()).filter(
    (s) => !auditorId || s.auditorId === auditorId
  );
}

module.exports = {
  startSchedule,
  createInspection,
  getInspectionById,
  getSchedulesByAuditor,
  schedulesStore,
  inspectionsStore
};
