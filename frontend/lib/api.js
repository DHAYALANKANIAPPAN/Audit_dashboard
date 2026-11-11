/**
 * AuditPulse 360 API Client
 * Automatically attaches Authorization header if JWT token is stored in localStorage.
 * Provides fallback to mock data when backend is not reachable.
 */

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
    throw new Error(data.error || 'Login failed');
  }

  setSession(data.token, data.user);
  return data;
}

export async function fetchApi(endpoint, options = {}) {
  const token = getStoredToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[API] Request failed for ${url}. Attempting mock fallback...`, err.message);

    if (typeof window !== 'undefined') {
      const mockResult = getMockFallback(endpoint);
      if (mockResult !== null) {
        return mockResult;
      }
    }

    throw err;
  }
}

function getMockFallback(endpoint) {
  if (endpoint.includes('/checklists')) {
    return [
      { id: 'ck-1', auditType: 'PRODUCT', section: 'Dimensional', itemText: 'Verify critical dimensions and mounting clearances against engineering drawing', order: 1 },
      { id: 'ck-2', auditType: 'PRODUCT', section: 'Fasteners', itemText: 'Check torque specifications on all load-bearing bolts and fasteners using calibrated tool', order: 2 },
      { id: 'ck-3', auditType: 'PRODUCT', section: 'Traceability', itemText: 'Confirm 2D DataMatrix / barcode readability and serial number label alignment', order: 3 },
      { id: 'ck-4', auditType: 'PRODUCT', section: 'Surface Quality', itemText: 'Check surface finish, paint thickness, and verify absence of scratches, dents, or burrs', order: 4 },
      { id: 'ck-5', auditType: 'PRODUCT', section: 'Electrical', itemText: 'Inspect wiring harness routing, tie-wrap security, and pin insertion depth', order: 5 },
      { id: 'ck-6', auditType: 'PRODUCT', section: 'Functional', itemText: 'Verify sub-assembly switch operation, latch engagement, and tactile feedback', order: 6 },
      { id: 'ck-7', auditType: 'PRODUCT', section: 'Contamination', itemText: 'Ensure component cleanliness and absence of foreign particulate (FOD)', order: 7 },
      { id: 'ck-8', auditType: 'PRODUCT', section: 'Packaging', itemText: 'Inspect protective foam fitment, moisture barrier bag, and shipping crate tagging', order: 8 },
    ];
  }

  if (endpoint.includes('/schedules/mine')) {
    return [
      {
        id: 'sch-demo-1',
        date: new Date().toISOString().split('T')[0],
        shift: 'A',
        status: 'PLANNED',
        plan: {
          auditType: 'PRODUCT',
          line: { name: 'Line 1 - Chassis & Frame' },
          product: 'EV Chassis Subframe',
          department: { name: 'Manufacturing' },
        },
      },
    ];
  }

  return null;
}
