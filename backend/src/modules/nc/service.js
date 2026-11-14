/**
 * STUB MODULE - LINGA's RESPONSIBILITY
 * Module: backend/src/modules/nc/service.js
 * 
 * Shared contract: exports createNcsFromInspection(inspection) -> returns array of NCs
 * This stub is clearly marked for replacement once Linga merges her module.
 */

// In-memory NC storage for stubbing/testing
const ncsStore = new Map();

/**
 * Creates Non-Conformance (NC) tickets from failed inspection checklist items
 * @param {Object} inspection - The saved inspection object with items
 * @returns {Array} Array of NC objects
 */
function createNcsFromInspection(inspection) {
  if (!inspection || !inspection.items) {
    return [];
  }

  const failedItems = inspection.items.filter((item) => item.result === 'FAIL');
  const now = new Date();

  const generatedNcs = failedItems.map((item, idx) => {
    // SLA target date based on severity
    const slaDays = item.severity === 'CRITICAL' ? 2 : item.severity === 'MAJOR' ? 7 : 14;
    const targetDate = new Date(now.getTime() + slaDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const ncNumber = `NC-${now.getFullYear()}-${String(ncsStore.size + idx + 1).padStart(4, '0')}`;
    const ncId = `nc-${Date.now()}-${idx + 1}`;

    const ncRecord = {
      id: ncId,
      ncNo: ncNumber,
      inspectionId: inspection.id,
      scheduleId: inspection.scheduleId,
      checklistItemId: item.checklistItemId,
      line: inspection.line || 'Line 1 - Engine Assembly',
      department: inspection.department || 'Assembly',
      severity: item.severity,
      remark: item.remark || '',
      evidenceIds: item.evidenceIds || [],
      auditeeId: 'usr-auditee-line1',
      status: 'OPEN',
      targetDate,
      createdAt: now.toISOString(),
      closedAt: null,
      escalatedAt: null
    };

    ncsStore.set(ncId, ncRecord);
    return ncRecord;
  });

  return generatedNcs;
}

module.exports = {
  createNcsFromInspection,
  ncsStore
};
