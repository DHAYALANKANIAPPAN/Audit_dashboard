/**
 * AuditPulse 360 API Client
 * Automatically attaches Authorization header if JWT token is stored in localStorage.
 * Provides fallback to mock data when backend is not reachable.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function fetchApi(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // If payload is FormData, do not set Content-Type header manually
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

    // Fallback handler for mock data in development/offline
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
      { id: 'ck-1', auditType: 'PRODUCT', itemText: 'Verify component dimensions meet engineering tolerance spec', order: 1 },
      { id: 'ck-2', auditType: 'PRODUCT', itemText: 'Check surface finish and paint adhesion per ASTM D3359', order: 2 },
      { id: 'ck-3', auditType: 'PRODUCT', itemText: 'Verify barcode readability with optical verification scan', order: 3 },
      { id: 'ck-4', auditType: 'PRODUCT', itemText: 'Ensure torque check on primary fasteners per assembly sheet', order: 4 },
      { id: 'ck-5', auditType: 'PRODUCT', itemText: 'Check electrical ground continuity < 0.1 ohm', order: 5 },
      { id: 'ck-6', auditType: 'PRODUCT', itemText: 'Verify packaging integrity and vibration cushioning', order: 6 },
      { id: 'ck-7', auditType: 'PRODUCT', itemText: 'Confirm safety labelling and serial number placement', order: 7 },
      { id: 'ck-8', auditType: 'PRODUCT', itemText: 'Check cleanliness and particulate contamination count', order: 8 },
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
          line: { name: 'Line 1 - Chassis' },
          product: 'Model-X Frame',
          department: { name: 'Assembly' },
        },
      },
    ];
  }

  return null;
}
