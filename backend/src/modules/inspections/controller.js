const { validateInspectionPayload } = require('./validation');
const inspectionService = require('./service');

/**
 * Start schedule (PATCH /api/schedules/:id/start)
 */
async function startSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const currentUser = req.user || { id: 'usr-bhava' };
    const result = inspectionService.startSchedule(id, currentUser);

    return res.status(200).json({
      success: true,
      message: result.idempotent ? 'Schedule is already IN_PROGRESS' : 'Schedule started successfully',
      schedule: result.schedule
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit inspection (POST /api/inspections)
 */
async function createInspection(req, res, next) {
  try {
    // 1. Zod Validation
    const validationResult = validateInspectionPayload(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid inspection payload',
          details: validationResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }
      });
    }

    // 2. Service execution with atomic schedule completion and Linga NC generation
    const currentUser = req.user || { id: 'usr-bhava' };
    const result = inspectionService.createInspection(validationResult.data, currentUser);

    // 3. Return 200 for idempotent duplicate clientId, 201 for new creation
    const statusCode = result.isDuplicate ? 200 : 201;

    return res.status(statusCode).json({
      success: true,
      isDuplicate: result.isDuplicate,
      inspection: result.inspection,
      ncs: result.ncs,
      ncCount: result.ncs.length
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get inspection by ID (GET /api/inspections/:id)
 */
async function getInspectionById(req, res, next) {
  try {
    const { id } = req.params;
    const inspection = inspectionService.getInspectionById(id);

    return res.status(200).json({
      success: true,
      inspection
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current auditor's assigned schedules (GET /api/schedules/mine)
 */
async function getMySchedules(req, res, next) {
  try {
    const auditorId = req.user?.id || 'usr-bhava';
    const schedules = inspectionService.getSchedulesByAuditor(auditorId);
    return res.status(200).json(schedules);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startSchedule,
  createInspection,
  getInspectionById,
  getMySchedules
};
