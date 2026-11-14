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
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed');
  }

  setSession(data.token, data.user);
  return data;
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

  try {
    const res = await fetch(`${API_BASE_URL}/inspections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getStoredToken() || 'mock-token'}`
      },
      body: JSON.stringify(payloadWithClientId)
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      const errMsg = errorJson?.error?.message || `HTTP ${res.status}`;
      const err = new Error(errMsg);
      err.details = errorJson?.error?.details;
      throw err;
    }

    return await res.json();
  } catch (err) {
    console.warn('[AuditPulse 360] Fallback submitInspection:', err.message);

    const failedItems = payloadWithClientId.items.filter((i) => i.result === 'FAIL');
    const simulatedNcs = failedItems.map((item, idx) => ({
      id: `nc-mock-${Date.now()}-${idx}`,
      ncNo: `NC-2026-${String(100 + idx).padStart(4, '0')}`,
      inspectionId: `insp-mock-${Date.now()}`,
      checklistItemId: item.checklistItemId,
      severity: item.severity,
      remark: item.remark,
      evidenceIds: item.evidenceIds || [],
      status: 'OPEN',
      targetDate: new Date(
        Date.now() + (item.severity === 'CRITICAL' ? 2 : item.severity === 'MAJOR' ? 7 : 14) * 86400000
      )
        .toISOString()
        .split('T')[0]
    }));

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auditpulse_schedules');
      if (stored) {
        const list = JSON.parse(stored);
        const item = list.find((s) => s.id === payloadWithClientId.scheduleId);
        if (item) {
          item.status = 'DONE';
          localStorage.setItem('auditpulse_schedules', JSON.stringify(list));
        }
      }
    }

    return {
      success: true,
      isDuplicate: false,
      inspection: {
        id: `insp-mock-${Date.now()}`,
        scheduleId: payloadWithClientId.scheduleId,
        submittedAt: new Date().toISOString()
      },
      ncs: simulatedNcs,
      ncCount: simulatedNcs.length
    };
  }
}

/**
 * Upload evidence photo (POST /api/evidence)
 */
export async function uploadEvidence(formData) {
  try {
    const res = await fetch(`${API_BASE_URL}/evidence`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AuditPulse 360] Fallback stub uploadEvidence:', err.message);
    await new Promise((r) => setTimeout(r, 400));

    const file = formData.get('file');
    const stubUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const localUrl = file ? URL.createObjectURL(file) : 'https://placehold.co/400x300/e2e8f0/475569?text=Defect+Evidence';

    return {
      id: `stub-${stubUuid}`,
      fileName: file ? file.name : `evidence-${stubUuid}.jpg`,
      url: localUrl,
      createdAt: new Date().toISOString()
    };
  }
}
