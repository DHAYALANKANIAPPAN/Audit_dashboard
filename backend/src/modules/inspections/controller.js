const { validateInspectionPayload } = require('./validation');
const inspectionService = require('./service');

async function startSchedule(req, res, next) {
  try {
    const result = await inspectionService.startSchedule(req.params.id, req.user);

    return res.status(200).json({
      success: true,
      message: result.idempotent
        ? 'Schedule is already IN_PROGRESS'
        : 'Schedule started successfully',
      schedule: result.schedule
    });
  } catch (err) {
    next(err);
  }
}

async function createInspection(req, res, next) {
  try {
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

    const result = await inspectionService.createInspection(
      validationResult.data,
      req.user
    );

    return res.status(result.isDuplicate ? 200 : 201).json({
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

async function getInspectionById(req, res, next) {
  try {
    const inspection = await inspectionService.getInspectionById(req.params.id);

    return res.status(200).json({
      success: true,
      inspection
    });
  } catch (err) {
    next(err);
  }
}

async function getMySchedules(req, res, next) {
  try {
    const schedules = await inspectionService.getSchedulesByAuditor(req.user.id);
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
