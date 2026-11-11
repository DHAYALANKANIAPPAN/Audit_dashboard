# AuditPulse 360 API Contract & Specification

This document defines the REST API endpoints, payload contracts, and owners across the team.

## Base URL
`/api`

---

## 1. Authentication & Users (Owner: Dhaya)
- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Response: `{ token, user: { id, name, email, role } }`
- `GET /api/auth/me`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ user }`

---

## 2. Planning & Roster (Owner: Dhaya)
- `GET /api/plans?month=YYYY-MM`
  - Response: `[{ id, month, auditType, line, department, product, plannedDate, shift }]`
- `POST /api/plans/upload`
  - Body: `multipart/form-data` with file (CSV/XLSX)
  - Response: `{ inserted: count, errors: [{ row, message }] }`
- `GET /api/plans/template`
  - Response: CSV template download
- `POST /api/roster/generate`
  - Body: `{ month: "YYYY-MM" }`
  - Response: `{ generatedCount, schedules: [...] }`
- `GET /api/roster?date=YYYY-MM-DD`
  - Response: `[{ id, planId, auditorId, date, shift, status }]`
- `GET /api/schedules/mine`
  - Response: Auditor's assigned schedules for today
- `PATCH /api/schedules/:id/reassign`
  - Body: `{ auditorId }`
  - Response: `{ updatedSchedule }`

---

## 3. Checklists & Inspections (Owner: Bhava / Dhaya)
- `GET /api/checklists?auditType=PRODUCT|REVALIDATION`
  - Response: `[{ id, auditType, itemText, order }]`
- `PATCH /api/schedules/:id/start`
  - Response: `{ id, status: "IN_PROGRESS" }`
- `POST /api/inspections`
  - Body: `{ scheduleId, items: [{ checklistItemId, result: "PASS"|"FAIL", severity, remark, evidenceIds: [] }] }`
  - Response: `{ inspection, ncs: [...] }`
- `GET /api/inspections/:id`
  - Response: Inspection details with item results

---

## 4. Non-Conformance (NC) & CAPA (Owner: Linga)
- `GET /api/ncs?status=&mine=1`
  - Response: `[{ id, ncNo, inspectionId, line, severity, auditeeId, status, targetDate, createdAt, closedAt, escalatedAt }]`
- `PATCH /api/ncs/:id/start`
  - Sets NC status to `IN_PROGRESS`
- `POST /api/ncs/:id/capa`
  - Body: `{ rootCauseMethod: "5WHY"|"8D", rootCause, corrective, preventive, ownerId, targetDate, evidenceIds: [] }`
  - Sets NC status to `SUBMITTED`
- `POST /api/evidence`
  - Body: Multipart file (`image/*` or `application/pdf`, max 10MB)
  - Response: `{ id, url, fileName }`
- `GET /api/evidence/:id`
  - Returns evidence file stream

---

## 5. Approvals & Sign-off (Owner: Linga)
- `POST /api/ncs/:id/verify` (Auditor only)
  - Body: `{ decision: "ACCEPT"|"REJECT", remark }`
  - ACCEPT -> `VERIFIED`, REJECT -> `IN_PROGRESS`
- `POST /api/ncs/:id/close` (Audit Head only)
  - Body: `{ decision: "ACCEPT"|"REJECT", remark }`
  - ACCEPT -> `CLOSED`, REJECT -> `IN_PROGRESS`
- `GET /api/approvals/pending`
  - Response: `{ pendingVerification: [...], pendingHeadSignoff: [...] }`

---

## 6. Notifications (Owner: Linga)
- `GET /api/notifications`
  - Response: `[{ id, userId, channel, title, body, read, createdAt }]`
- `PATCH /api/notifications/:id/read`
  - Sets `read = true`

---

## 7. Analytics & Reports (Owner: Akshiya)
- `GET /api/analytics/summary?from=&to=&line=&shift=&department=`
  - Response: KPI summary, completion %, NC counts, aging buckets, workload, recurring failures
- `GET /api/history?q=&from=&to=&line=&auditor=&status=&ncNo=&page=`
  - Paginated audit and NC search
- `GET /api/reports/export?format=pdf|xlsx&type=summary|nc-register|audit-register`
  - Stream binary PDF or Excel file
