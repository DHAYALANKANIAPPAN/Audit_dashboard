import { openDB } from 'idb';
import { uploadEvidence } from './api';

const DB_NAME = 'auditpulse';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

let dbPromise = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'clientId'
          });
          store.createIndex('createdAt', 'createdAt');
          store.createIndex('status', 'status');
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Enqueue an inspection for offline background sync
 */
export async function enqueueInspection(inspectionData) {
  const db = await getDB();
  if (!db) return null;

  const queueEntry = {
    clientId: inspectionData.clientId,
    scheduleId: inspectionData.scheduleId,
    payload: inspectionData,
    photosToUpload: inspectionData.pendingPhotos || [], // [{ tempId, blob, fileName, checklistItemId }]
    createdAt: Date.now(),
    status: 'QUEUED', // 'QUEUED' | 'SYNCING' | 'FAILED'
    retryCount: 0,
    lastError: null
  };

  await db.put(STORE_NAME, queueEntry);
  console.log('[AuditPulse Offline] Enqueued inspection:', queueEntry.clientId);
  return queueEntry;
}

/**
 * Get all queued inspections ordered by creation time
 */
export async function getPendingQueue() {
  const db = await getDB();
  if (!db) return [];

  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('createdAt');
  const all = await index.getAll();
  return all.filter((item) => item.status !== 'FAILED');
}

/**
 * Remove an inspection from the offline queue after successful sync
 */
export async function removeQueueItem(clientId) {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE_NAME, clientId);
  console.log('[AuditPulse Offline] Removed synced inspection:', clientId);
}

/**
 * Get the total count of queued items pending sync
 */
export async function getQueueCount() {
  const db = await getDB();
  if (!db) return 0;
  const all = await db.getAll(STORE_NAME);
  return all.filter((item) => item.status !== 'FAILED').length;
}

/**
 * Mark a queue item as failed with error details (e.g. 4xx validation) so it does not block others
 */
export async function markItemFailed(clientId, error) {
  const db = await getDB();
  if (!db) return;
  const item = await db.get(STORE_NAME, clientId);
  if (item) {
    item.status = 'FAILED';
    item.lastError = error;
    await db.put(STORE_NAME, item);
  }
}

// Mutex lock to prevent concurrent sync flushes
let isFlushing = false;
let backoffDelay = 2000; // starts at 2s, capped at 60s

/**
 * Flush queue in order: uploads pending photos first, then posts inspection payload.
 * Notifies listener callback when items are synced.
 *
 * @param {Function} onSyncCallback - Callback called with { syncedCount, errors }
 */
export async function flushQueue(onSyncCallback) {
  if (isFlushing) {
    console.log('[AuditPulse Offline] Sync already in progress, skipping concurrent call.');
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[AuditPulse Offline] Device is offline, flush deferred.');
    return;
  }

  isFlushing = true;
  let syncedCount = 0;
  const errors = [];

  try {
    const queue = await getPendingQueue();
    if (queue.length === 0) {
      isFlushing = false;
      return;
    }

    console.log(`[AuditPulse Offline] Flushing ${queue.length} item(s) from offline queue...`);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    for (const entry of queue) {
      try {
        // Step 1: Upload any pending photos for this inspection first
        const uploadedEvidenceMap = {}; // tempId -> evidenceId

        if (entry.photosToUpload && entry.photosToUpload.length > 0) {
          for (const photo of entry.photosToUpload) {
            if (photo.blob) {
              const formData = new FormData();
              formData.append('file', photo.blob, photo.fileName || 'photo.jpg');
              formData.append('checklistItemId', photo.checklistItemId);

              const uploadRes = await uploadEvidence(formData);
              if (uploadRes && uploadRes.id) {
                uploadedEvidenceMap[photo.tempId] = uploadRes.id;
              }
            }
          }
        }

        // Step 2: Update item evidenceIds with newly uploaded photo IDs
        const finalPayload = {
          clientId: entry.payload.clientId,
          scheduleId: entry.payload.scheduleId,
          submittedAt: entry.payload.submittedAt || new Date().toISOString(),
          items: entry.payload.items.map((item) => {
            const extraIds = (item.photoTempIds || [])
              .map((tempId) => uploadedEvidenceMap[tempId])
              .filter(Boolean);

            return {
              checklistItemId: item.checklistItemId,
              result: item.result,
              severity: item.severity,
              remark: item.remark,
              evidenceIds: [...(item.evidenceIds || []), ...extraIds]
            };
          })
        };

        // Step 3: Send POST /api/inspections with stored clientId
        const res = await fetch(`${API_BASE}/inspections`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') || 'mock-token' : ''}`
          },
          body: JSON.stringify(finalPayload)
        });

        // 2xx response: sync successful, remove from queue
        if (res.ok) {
          await removeQueueItem(entry.clientId);
          syncedCount++;
          backoffDelay = 2000; // Reset backoff on success
        } else if (res.status >= 400 && res.status < 500) {
          // 4xx validation or client error: mark failed and do NOT block the rest
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status}`;
          console.error(`[AuditPulse Offline] 4xx error for ${entry.clientId}:`, errMsg);
          await markItemFailed(entry.clientId, errMsg);
          errors.push({ clientId: entry.clientId, error: errMsg });
        } else {
          // 5xx server error: stop flush and retry with backoff
          throw new Error(`Server error: HTTP ${res.status}`);
        }
      } catch (itemErr) {
        // Network failure during flush: stop processing rest of queue and schedule exponential retry
        console.warn('[AuditPulse Offline] Network interruption during flush:', itemErr.message);
        backoffDelay = Math.min(backoffDelay * 2, 60000); // Exponential backoff capped at 60s
        setTimeout(() => flushQueue(onSyncCallback), backoffDelay);
        break; // Stop loop on network disconnect
      }
    }

    if (syncedCount > 0 && typeof onSyncCallback === 'function') {
      onSyncCallback({ syncedCount, errors });
    }
  } catch (err) {
    console.error('[AuditPulse Offline] Unexpected error in flushQueue:', err);
  } finally {
    isFlushing = false;
  }
}

/**
 * Sets up background sync triggers:
 * 1. window 'online' event
 * 2. visibilitychange to visible (when user returns to tab)
 * 3. 30s interval while queue > 0
 *
 * @param {Function} onSyncSuccess - Toast callback function
 */
export function initBackgroundSync(onSyncSuccess) {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('[AuditPulse Offline] Network reconnected. Starting auto-sync...');
    flushQueue(onSyncSuccess);
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushQueue(onSyncSuccess);
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  // Initial flush on load if online
  if (navigator.onLine) {
    flushQueue(onSyncSuccess);
  }

  // Periodic 30s check if queue has items
  const intervalId = setInterval(async () => {
    if (navigator.onLine) {
      const count = await getQueueCount();
      if (count > 0) {
        flushQueue(onSyncSuccess);
      }
    }
  }, 30000);

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(intervalId);
  };
}
