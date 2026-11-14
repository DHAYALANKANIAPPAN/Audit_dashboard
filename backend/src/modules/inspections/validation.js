const { z } = require('zod');

// Single checklist item validation
const inspectionItemSchema = z
  .object({
    checklistItemId: z.string({
      required_error: 'checklistItemId is required'
    }).min(1, 'checklistItemId cannot be empty'),
    result: z.enum(['PASS', 'FAIL'], {
      required_error: 'result must be either PASS or FAIL',
      invalid_type_error: 'result must be either PASS or FAIL'
    }),
    severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).nullable().optional(),
    remark: z.string().optional().default(''),
    evidenceIds: z.array(z.string()).optional().default([])
  })
  .superRefine((data, ctx) => {
    // FAIL item validation
    if (data.result === 'FAIL') {
      if (!data.severity || !['MINOR', 'MAJOR', 'CRITICAL'].includes(data.severity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['severity'],
          message: 'FAIL item requires severity (MINOR, MAJOR, or CRITICAL)'
        });
      }
      if (!data.remark || typeof data.remark !== 'string' || data.remark.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remark'],
          message: 'FAIL item requires a non-empty defect remark'
        });
      }
    }

    // PASS item validation
    if (data.result === 'PASS') {
      if (data.severity !== undefined && data.severity !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['severity'],
          message: 'PASS item must not carry severity'
        });
      }
    }
  });

// Complete inspection submission schema
const createInspectionSchema = z.object({
  clientId: z.string({
    required_error: 'clientId is required for idempotency'
  }).min(1, 'clientId cannot be empty'),
  scheduleId: z.string({
    required_error: 'scheduleId is required'
  }).min(1, 'scheduleId cannot be empty'),
  items: z.array(inspectionItemSchema, {
    required_error: 'items array is required'
  }).min(1, 'items array must not be empty')
});

function validateInspectionPayload(data) {
  return createInspectionSchema.safeParse(data);
}

module.exports = {
  createInspectionSchema,
  validateInspectionPayload
};
