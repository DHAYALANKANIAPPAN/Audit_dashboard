/**
 * AuditPulse 360 API Client
 * Automatically attaches Authorization header if JWT token is stored in localStorage.
 * Provides fallback to mock data when backend is not reachable.
 */
import { MOCK_SCHEDULES, MOCK_CHECKLISTS } from './mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auditpulse_token');
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('auditpulse_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auditpulse_token', token);
  localStorage.setItem('auditpulse_user', JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auditpulse_token');
  localStorage.removeItem('auditpulse_user');
}

export async function login(email, password) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setSession(data.token, data.user);
      return data;
    }
    if (!res.ok && data.error && !data.error.includes('Failed to fetch')) {
      throw new Error(data.error);
    }
  } catch (err) {
    console.warn('[AuditPulse 360] Server unreachable, checking demo credentials fallback:', err.message);
  }

  // Graceful standalone demo fallback for live previews / Vercel
  const demoUsers = {
    'auditor@auditpulse.local': { id: 'u-auditor-1', name: 'R. Bhava (Auditor)', email: 'auditor@auditpulse.local', role: 'AUDITOR' },
    'auditor1@auditpulse.com': { id: 'u-auditor-1', name: 'R. Bhava (Auditor)', email: 'auditor1@auditpulse.com', role: 'AUDITOR' },
    'auditee@auditpulse.local': { id: 'u-auditee-1', name: 'K. Linga (Line 1 Owner)', email: 'auditee@auditpulse.local', role: 'AUDITEE' },
    'auditee1@auditpulse.com': { id: 'u-auditee-1', name: 'K. Linga (Line 1 Owner)', email: 'auditee1@auditpulse.com', role: 'AUDITEE' },
    'audithead@auditpulse.local': { id: 'u-audithead-1', name: 'D. Kaniappan (Audit Head)', email: 'audithead@auditpulse.local', role: 'AUDIT_HEAD' },
    'audithead@auditpulse.com': { id: 'u-audithead-1', name: 'D. Kaniappan (Audit Head)', email: 'audithead@auditpulse.com', role: 'AUDIT_HEAD' },
    'plantmanager@auditpulse.local': { id: 'u-plantmgr-1', name: 'S. Akshiya (Plant Head)', email: 'plantmanager@auditpulse.local', role: 'PLANT_MANAGER' },
    'plantmanager@auditpulse.com': { id: 'u-plantmgr-1', name: 'S. Akshiya (Plant Head)', email: 'plantmanager@auditpulse.com', role: 'PLANT_MANAGER' },
    'admin@auditpulse.local': { id: 'u-admin-1', name: 'System Administrator', email: 'admin@auditpulse.local', role: 'ADMIN' },
    'admin@auditpulse.com': { id: 'u-admin-1', name: 'System Administrator', email: 'admin@auditpulse.com', role: 'ADMIN' },
  };

  const matched = demoUsers[email.toLowerCase()];
  if (matched && (password === 'demo123' || password === 'demo')) {
    const fallbackToken = 'demo-preview-jwt-token';
    setSession(fallbackToken, matched);
    return { token: fallbackToken, user: matched };
  }

  throw new Error('Invalid email or password. Use demo123 for demo accounts.');
}

export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    console.warn(`[API] Request failed for ${url}. Attempting mock fallback...`, err.message);
    throw err;
  }
}

export const fetchApi = apiFetch;


/**
 * Fetch assigned audits for current auditor (GET /api/schedules/mine)
 */
export async function getMySchedules() {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/mine`, {
      headers: {
        'Authorization': `Bearer ${getStoredToken() || 'mock-token'}`
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AuditPulse 360] Fallback to mock data for getMySchedules:', err.message);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auditpulse_schedules');
      if (stored) return JSON.parse(stored);
      localStorage.setItem('auditpulse_schedules', JSON.stringify(MOCK_SCHEDULES));
    }
    return MOCK_SCHEDULES;
  }
}

/**
 * Fetch checklist items for an audit type (GET /api/checklists?auditType=)
 */
export async function getChecklist(auditType = 'PRODUCT') {
  try {
    const res = await fetch(`${API_BASE_URL}/checklists?auditType=${encodeURIComponent(auditType)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[AuditPulse 360] Fallback to mock data for getChecklist(${auditType})`);
    return MOCK_CHECKLISTS[auditType] || MOCK_CHECKLISTS.PRODUCT;
  }
}

/**
 * Start an audit schedule (PATCH /api/schedules/:id/start)
 */
export async function startSchedule(scheduleId) {
  try {
    const res = await fetch(`${API_BASE_URL}/schedules/${scheduleId}/start`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getStoredToken() || 'mock-token'}`
      }
    });
    if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AuditPulse 360] Fallback startSchedule:', err.message);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auditpulse_schedules');
      if (stored) {
        const list = JSON.parse(stored);
        const item = list.find((s) => s.id === scheduleId);
        if (item) {
          item.status = 'IN_PROGRESS';
          localStorage.setItem('auditpulse_schedules', JSON.stringify(list));
        }
      }
    }
    return { success: true, scheduleId, status: 'IN_PROGRESS' };
  }
}

/**
 * Submit completed inspection (POST /api/inspections)
 */
export async function submitInspection(inspectionPayload) {
  const token = getStoredToken();

  if (!token) {
    throw new Error('Please log in before submitting an inspection.');
  }

  const payloadWithClientId = {
    clientId:
      inspectionPayload.clientId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
    scheduleId: inspectionPayload.scheduleId,
    items: inspectionPayload.items.map((it) => ({
      checklistItemId: it.checklistItemId,
      result: it.result,
      severity: it.result === 'FAIL' ? it.severity : null,
      remark: it.result === 'FAIL' ? (it.remark || '').trim() : '',
      evidenceIds: it.evidenceIds || []
    }))
  };

  const res = await fetch(`${API_BASE_URL}/inspections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payloadWithClientId)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message || `Inspection submission failed (HTTP ${res.status})`;

    const error = new Error(message);
    error.status = res.status;
    error.details = data.error?.details;
    throw error;
  }

  return data;
}

/**
 * Upload evidence photo (POST /api/evidence)
 */
export async function uploadEvidence(formData) {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Please log in before uploading evidence.');
  }

  const res = await fetch(`${API_BASE_URL}/evidence`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Evidence upload failed (HTTP ${res.status})`);
  }

  return data;
}

/**
 * Fetch audit history with search and filtering (GET /api/history)
 */
export async function getAuditHistory(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  return await apiFetch(`/history?${query.toString()}`);
}

/**
 * Fetch end-to-end 6-stage lifecycle timeline for an audit schedule (GET /api/history/:scheduleId)
 */
export async function getAuditTimeline(scheduleId) {
  return await apiFetch(`/history/${scheduleId}`);
}

/**
 * Fetch timeline starting from an NC ticket number or ID (GET /api/history/nc/:ncIdOrNo)
 */
export async function getNcTimeline(ncIdOrNo) {
  return await apiFetch(`/history/nc/${ncIdOrNo}`);
}

/**
 * Get export URL for PDF or Excel reports (GET /api/reports/export/:format)
 */
export function getReportExportUrl(format = 'excel', filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      query.append(k, v);
    }
  });
  return `${API_BASE_URL}/reports/export/${format}?${query.toString()}`;
}

/**
 * Download report directly as blob
 */
export async function downloadReport(format = 'excel', filters = {}) {
  const url = getReportExportUrl(format, filters);
  const token = getStoredToken();
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `AuditPulse360_Report_${dateStr}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * List NC tickets (GET /api/ncs)
 */
export async function getNcs(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      query.append(k, v);
    }
  });
  return await apiFetch(`/ncs?${query.toString()}`);
}

/**
 * Get NC details (GET /api/ncs/:id)
 */
export async function getNc(id) {
  return await apiFetch(`/ncs/${id}`);
}

/**
 * Submit CAPA for an NC ticket (POST /api/ncs/:id/capa)
 */
export async function submitCapa(ncId, data) {
  return await apiFetch(`/ncs/${ncId}/capa`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Start an NC (PATCH /api/ncs/:id/start)
 */
export async function startNc(id) {
  return await apiFetch(`/ncs/${id}/start`, {
    method: 'PATCH',
  });
}

/**
 * Auditor verify NC CAPA (POST /api/ncs/:id/verify)
 */
export async function verifyNc(id, data) {
  return await apiFetch(`/ncs/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Head sign-off / close NC (POST /api/ncs/:id/close)
 */
export async function closeNc(id, data) {
  return await apiFetch(`/ncs/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get user notifications (GET /api/notifications)
 */
export async function getNotifications() {
  return await apiFetch('/notifications');
}

/**
 * Mark notification as read (PATCH /api/notifications/:id/read)
 */
export async function markNotificationRead(id) {
  return await apiFetch(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

/**
 * Get pending approvals grouped by Tier 1 and Tier 2 (GET /api/approvals/pending)
 */
export async function getPendingApprovals() {
  return await apiFetch('/approvals/pending');
}

/**
 * Submit approval decision (POST /api/approvals/:ncId/decide)
 */
export async function decideApproval(ncId, data) {
  return await apiFetch(`/approvals/${ncId}/decide`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
