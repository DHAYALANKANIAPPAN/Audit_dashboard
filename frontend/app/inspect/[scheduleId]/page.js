'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMySchedules, getChecklist, submitInspection, startSchedule, uploadEvidence } from '../../../lib/api';
import { preparePhoto } from '../../../lib/photoUtils';
import { enqueueInspection, getQueueCount, initBackgroundSync } from '../../../lib/offlineQueue';
import { Button, Badge, Spinner, Toast } from '../../../components/common';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Trash2,
  Send,
  Check,
  ShieldAlert,
  Info,
  Layers,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
  RotateCcw,
  Loader2,
  Save,
  CloudOff
} from 'lucide-react';

export default function ChecklistInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params?.scheduleId;

  const [schedule, setSchedule] = useState(null);
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const fileInputRefs = useRef({});

  // Session storage key
  const storageKey = `auditpulse_inspection_${scheduleId}`;

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadData();
    updatePendingQueueCount();

    // Auto background sync listener
    const cleanupSync = initBackgroundSync(({ syncedCount }) => {
      updatePendingQueueCount();
      if (syncedCount > 0) {
        setToastMessage({
          text: `Auto-Sync: Synced ${syncedCount} inspection(s) successfully!`,
          type: 'success'
        });
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupSync();
    };
  }, [scheduleId]);

  async function updatePendingQueueCount() {
    try {
      const count = await getQueueCount();
      setQueuedCount(count);
    } catch (e) {
      console.warn('Could not read queue count:', e);
    }
  }

  // Persist answers to sessionStorage whenever answers change
  useEffect(() => {
    if (scheduleId && Object.keys(answers).length > 0) {
      try {
        const serializableAnswers = {};
        for (const [key, val] of Object.entries(answers)) {
          serializableAnswers[key] = {
            ...val,
            photos: (val.photos || []).map((p) => ({
              tempId: p.tempId,
              previewUrl: p.previewUrl,
              fileName: p.fileName,
              status: p.status,
              evidenceId: p.evidenceId,
              remoteUrl: p.remoteUrl
            }))
          };
        }
        sessionStorage.setItem(storageKey, JSON.stringify(serializableAnswers));
      } catch (e) {
        console.warn('Session storage quota or access error', e);
      }
    }
  }, [answers, scheduleId]);

  async function loadData() {
    setLoading(true);
    try {
      const allSchedules = await getMySchedules();
      const current = allSchedules.find((s) => s.id === scheduleId) || {
        id: scheduleId,
        auditType: 'PRODUCT',
        line: 'Line 1 - Engine Assembly',
        department: 'Assembly',
        product: 'V6 Turbo Engine Block',
        shift: 'A',
        status: 'IN_PROGRESS'
      };
      setSchedule(current);

      // 6b: Starting audit offline is handled safely
      try {
        await startSchedule(scheduleId);
      } catch (e) {
        console.warn('Offline: safely deferred schedule start', e);
      }

      const checklistData = await getChecklist(current.auditType || 'PRODUCT');
      setItems(checklistData);

      let restoredAnswers = null;
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          restoredAnswers = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Error reading sessionStorage:', e);
      }

      if (restoredAnswers) {
        setAnswers(restoredAnswers);
        setToastMessage({ text: 'Restored your in-progress audit answers from session.', type: 'info' });
      } else {
        const initialAnswers = {};
        checklistData.forEach((item) => {
          initialAnswers[item.id] = {
            checklistItemId: item.id,
            result: null,
            severity: null,
            remark: '',
            evidenceIds: [],
            photos: []
          };
        });
        setAnswers(initialAnswers);
      }
    } catch (err) {
      console.error('Error loading checklist data:', err);
      setToastMessage({ text: 'Failed to load checklist details', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const handleSelectResult = (itemId, result) => {
    setAnswers((prev) => {
      const current = prev[itemId] || {};
      if (result === 'PASS') {
        return {
          ...prev,
          [itemId]: {
            ...current,
            result: 'PASS',
            severity: null,
            remark: '',
            evidenceIds: [],
            photos: []
          }
        };
      }
      return {
        ...prev,
        [itemId]: {
          ...current,
          result: 'FAIL'
        }
      };
    });
  };

  const handleSelectSeverity = (itemId, severity) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        severity
      }
    }));
  };

  const handleRemarkChange = (itemId, remark) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        remark
      }
    }));
  };

  const handlePhotoCapture = async (itemId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const currentPhotos = answers[itemId]?.photos || [];
    if (currentPhotos.length >= 5) {
      setToastMessage({ text: 'Maximum 5 photos allowed per defect item', type: 'warning' });
      return;
    }

    try {
      const prepared = await preparePhoto(file);

      // If offline, store locally as READY without failing
      if (!navigator.onLine) {
        prepared.status = 'READY';
        setAnswers((prev) => {
          const itemAnswers = prev[itemId] || {};
          return {
            ...prev,
            [itemId]: {
              ...itemAnswers,
              photos: [...(itemAnswers.photos || []), prepared]
            }
          };
        });
        setToastMessage({ text: 'Photo saved locally (Offline mode)', type: 'info' });
        return;
      }

      prepared.status = 'UPLOADING';
      setAnswers((prev) => {
        const itemAnswers = prev[itemId] || {};
        return {
          ...prev,
          [itemId]: {
            ...itemAnswers,
            photos: [...(itemAnswers.photos || []), prepared]
          }
        };
      });

      await uploadSinglePhoto(itemId, prepared);
    } catch (err) {
      console.error('Photo processing failed:', err);
      setToastMessage({ text: 'Failed to process image: ' + err.message, type: 'error' });
    }
  };

  const uploadSinglePhoto = async (itemId, photoObj) => {
    try {
      setAnswers((prev) => {
        const itemAnswers = prev[itemId] || {};
        const updatedPhotos = (itemAnswers.photos || []).map((p) =>
          p.tempId === photoObj.tempId ? { ...p, status: 'UPLOADING', error: null } : p
        );
        return { ...prev, [itemId]: { ...itemAnswers, photos: updatedPhotos } };
      });

      const formData = new FormData();
      formData.append('file', photoObj.blob, photoObj.fileName);
      formData.append('checklistItemId', itemId);

      const res = await uploadEvidence(formData);

      setAnswers((prev) => {
        const itemAnswers = prev[itemId] || {};
        const updatedPhotos = (itemAnswers.photos || []).map((p) =>
          p.tempId === photoObj.tempId
            ? { ...p, status: 'UPLOADED', evidenceId: res.id, remoteUrl: res.url }
            : p
        );
        const evidenceIds = updatedPhotos
          .filter((p) => p.status === 'UPLOADED' && p.evidenceId)
          .map((p) => p.evidenceId);

        return {
          ...prev,
          [itemId]: {
            ...itemAnswers,
            photos: updatedPhotos,
            evidenceIds
          }
        };
      });
    } catch (err) {
      console.warn('Upload failed (will queue for offline sync if needed):', err);
      setAnswers((prev) => {
        const itemAnswers = prev[itemId] || {};
        const updatedPhotos = (itemAnswers.photos || []).map((p) =>
          p.tempId === photoObj.tempId ? { ...p, status: 'ERROR', error: err.message } : p
        );
        return { ...prev, [itemId]: { ...itemAnswers, photos: updatedPhotos } };
      });
    }
  };

  const handleRemovePhoto = (itemId, tempId) => {
    setAnswers((prev) => {
      const itemAnswers = prev[itemId] || {};
      const updatedPhotos = (itemAnswers.photos || []).filter((p) => p.tempId !== tempId);
      const evidenceIds = updatedPhotos
        .filter((p) => p.status === 'UPLOADED' && p.evidenceId)
        .map((p) => p.evidenceId);

      return {
        ...prev,
        [itemId]: {
          ...itemAnswers,
          photos: updatedPhotos,
          evidenceIds
        }
      };
    });
  };

  const totalItems = items.length;
  const answeredItems = items.filter((item) => answers[item.id]?.result !== null);
  const passedCount = items.filter((item) => answers[item.id]?.result === 'PASS').length;
  const failedCount = items.filter((item) => answers[item.id]?.result === 'FAIL').length;
  const progressPercent = totalItems > 0 ? Math.round((answeredItems.length / totalItems) * 100) : 0;

  const minorCount = items.filter(
    (item) => answers[item.id]?.result === 'FAIL' && answers[item.id]?.severity === 'MINOR'
  ).length;
  const majorCount = items.filter(
    (item) => answers[item.id]?.result === 'FAIL' && answers[item.id]?.severity === 'MAJOR'
  ).length;
  const criticalCount = items.filter(
    (item) => answers[item.id]?.result === 'FAIL' && answers[item.id]?.severity === 'CRITICAL'
  ).length;

  const isAnyPhotoUploading = Object.values(answers).some((ans) =>
    (ans.photos || []).some((p) => p.status === 'UPLOADING')
  );

  const getInvalidItemIds = () => {
    return items
      .filter((item) => {
        const ans = answers[item.id];
        if (!ans || ans.result === null) return true;
        if (ans.result === 'FAIL') {
          if (!ans.severity) return true;
          if (!ans.remark || ans.remark.trim() === '') return true;
        }
        return false;
      })
      .map((item) => item.id);
  };

  const invalidItemIds = getInvalidItemIds();
  const isFormValid = totalItems > 0 && invalidItemIds.length === 0 && !isAnyPhotoUploading;

  const handleReviewClick = () => {
    setHasAttemptedSubmit(true);
    if (!isFormValid) {
      if (isAnyPhotoUploading) {
        setToastMessage({ text: 'Please wait for photos to finish uploading.', type: 'warning' });
        return;
      }
      const firstInvalidId = invalidItemIds[0];
      if (firstInvalidId) {
        const element = document.getElementById(`item-card-${firstInvalidId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      setToastMessage({
        text: `Please complete all required fields. ${invalidItemIds.length} item(s) pending.`,
        type: 'warning'
      });
      return;
    }

    setShowReviewModal(true);
  };

  // Step 5: Offline-First Submit Logic
  const handleConfirmSubmit = async () => {
    setSubmitting(true);

    const clientId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Collect any un-uploaded photo blobs to queue for offline sync
    const pendingPhotos = [];
    const inspectionItems = items.map((item) => {
      const ans = answers[item.id];
      const uploadedIds = [];
      const photoTempIds = [];

      (ans.photos || []).forEach((photo) => {
        if (photo.status === 'UPLOADED' && photo.evidenceId) {
          uploadedIds.push(photo.evidenceId);
        } else if (photo.blob) {
          pendingPhotos.push({
            tempId: photo.tempId,
            blob: photo.blob,
            fileName: photo.fileName,
            checklistItemId: item.id
          });
          photoTempIds.push(photo.tempId);
        }
      });

      return {
        checklistItemId: item.id,
        result: ans.result,
        severity: ans.severity || null,
        remark: ans.remark?.trim() || '',
        evidenceIds: uploadedIds,
        photoTempIds
      };
    });

    const payload = {
      clientId,
      scheduleId,
      submittedAt: new Date().toISOString(),
      items: inspectionItems,
      pendingPhotos
    };

    // 1. If currently offline, directly enqueue and confirm
    if (!navigator.onLine) {
      try {
        await enqueueInspection(payload);
        updatePendingQueueCount();

        // Clear session storage
        try {
          sessionStorage.removeItem(storageKey);
        } catch (e) {}

        setShowReviewModal(false);
        setSubmissionResult({
          isOfflineSaved: true,
          ncCount: failedCount,
          message: 'Saved offline, will sync automatically once network returns.'
        });
        setToastMessage({
          text: 'Saved offline! Inspection will auto-sync when connection is restored.',
          type: 'info'
        });
      } catch (err) {
        console.error('Failed to enqueue offline:', err);
        setToastMessage({ text: 'Error saving offline queue: ' + err.message, type: 'error' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 2. Online: Attempt direct submit; if network drops, enqueue
    try {
      const result = await submitInspection(payload);

      try {
        sessionStorage.removeItem(storageKey);
      } catch (e) {}

      setShowReviewModal(false);
      setSubmissionResult(result);
    } catch (err) {
      console.warn('Network submit failed:', err);

      // Distinguish 4xx validation errors (do NOT queue) from network errors (enqueue!)
      if (err.details || (err.message && err.message.includes('400'))) {
        setToastMessage({
          text: 'Validation error from server: ' + err.message,
          type: 'error'
        });
      } else {
        // Network error: Enqueue to IndexedDB!
        await enqueueInspection(payload);
        updatePendingQueueCount();

        try {
          sessionStorage.removeItem(storageKey);
        } catch (e) {}

        setShowReviewModal(false);
        setSubmissionResult({
          isOfflineSaved: true,
          ncCount: failedCount,
          message: 'Network interrupted. Saved to offline queue and will sync automatically.'
        });
        setToastMessage({
          text: 'Network issue. Saved offline, will sync automatically.',
          type: 'warning'
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Spinner size="lg" label="Loading checklist inspection sheet..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28">
      {/* Toast Alert */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/inspect"
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {schedule?.product || 'Shop-Floor Checklist'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {schedule?.line} &bull; Shift {schedule?.shift}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isOnline
                  ? queuedCount > 0
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline
                ? queuedCount > 0
                  ? `Online (${queuedCount} queued)`
                  : 'Online'
                : queuedCount > 0
                ? `Offline: ${queuedCount} saved`
                : 'Offline'}
            </span>
          </div>
        </div>

        {/* Sticky Progress Bar */}
        <div className="max-w-3xl mx-auto mt-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span>
              Progress: <strong className="text-indigo-600">{answeredItems.length} / {totalItems}</strong> answered ({progressPercent}%)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">{passedCount} Pass</span>
              <span>&bull;</span>
              <span className="text-rose-600 font-bold">{failedCount} Fail</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      {/* Checklist Items */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {items.map((item, index) => {
          const ans = answers[item.id] || {};
          const isPassed = ans.result === 'PASS';
          const isFailed = ans.result === 'FAIL';
          const isAnswered = ans.result !== null;

          const isMissingSeverity = isFailed && !ans.severity;
          const isMissingRemark = isFailed && (!ans.remark || !ans.remark.trim());
          const hasError = hasAttemptedSubmit && (!isAnswered || isMissingSeverity || isMissingRemark);
          const photos = ans.photos || [];

          return (
            <div
              id={`item-card-${item.id}`}
              key={item.id}
              className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-sm scroll-mt-28 ${
                hasError
                  ? 'border-rose-400 ring-2 ring-rose-300 bg-rose-50/20'
                  : isFailed
                  ? 'border-rose-300 bg-rose-50/10'
                  : isPassed
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    {item.standard && (
                      <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                        Std: {item.standard}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 pt-1 leading-snug">
                    {item.description}
                  </h3>
                  {item.method && (
                    <p className="text-xs text-slate-500 font-medium">
                      Method: {item.method}
                    </p>
                  )}
                </div>

                {isPassed && (
                  <span className="shrink-0 text-emerald-600 bg-emerald-100 p-1.5 rounded-full">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </span>
                )}
                {isFailed && !isMissingSeverity && !isMissingRemark && (
                  <span className="shrink-0 text-rose-600 bg-rose-100 p-1.5 rounded-full">
                    <XCircle className="w-4 h-4" />
                  </span>
                )}
              </div>

              {/* Large Buttons: PASS & FAIL */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleSelectResult(item.id, 'PASS')}
                  className={`flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl font-bold text-sm sm:text-base transition-all duration-150 active:scale-[0.98] select-none ${
                    isPassed
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 ring-2 ring-emerald-600 ring-offset-2'
                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                  }`}
                >
                  <CheckCircle className={`w-5 h-5 ${isPassed ? 'text-white' : 'text-emerald-600'}`} />
                  <span>PASS</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectResult(item.id, 'FAIL')}
                  className={`flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl font-bold text-sm sm:text-base transition-all duration-150 active:scale-[0.98] select-none ${
                    isFailed
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-200 ring-2 ring-rose-600 ring-offset-2'
                      : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                  }`}
                >
                  <XCircle className={`w-5 h-5 ${isFailed ? 'text-white' : 'text-rose-600'}`} />
                  <span>FAIL</span>
                </button>
              </div>

              {hasError && !isAnswered && (
                <div className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Please inspect and mark as PASS or FAIL</span>
                </div>
              )}

              {/* Conditional FAIL Section */}
              {isFailed && (
                <div className="mt-4 pt-4 border-t border-rose-200 space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Defect Severity <span className="text-rose-600">*</span></span>
                      {isMissingSeverity && hasError && (
                        <span className="text-rose-600 text-[11px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Required
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'MINOR', label: 'MINOR', color: 'border-amber-500 bg-amber-500 text-white', hover: 'hover:bg-amber-50 text-amber-800 border-amber-300' },
                        { key: 'MAJOR', label: 'MAJOR', color: 'border-orange-500 bg-orange-600 text-white', hover: 'hover:bg-orange-50 text-orange-800 border-orange-300' },
                        { key: 'CRITICAL', label: 'CRITICAL', color: 'border-rose-600 bg-rose-600 text-white', hover: 'hover:bg-rose-50 text-rose-800 border-rose-300' }
                      ].map((sev) => (
                        <button
                          key={sev.key}
                          type="button"
                          onClick={() => handleSelectSeverity(item.id, sev.key)}
                          className={`min-h-[46px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-95 ${
                            ans.severity === sev.key
                              ? sev.color + ' shadow-sm ring-2 ring-offset-1 ring-slate-400'
                              : 'bg-white ' + sev.hover
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Defect Remark & Location <span className="text-rose-600">*</span></span>
                      {isMissingRemark && hasError && (
                        <span className="text-rose-600 text-[11px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Mandatory defect remark
                        </span>
                      )}
                    </label>
                    <textarea
                      rows={2}
                      value={ans.remark || ''}
                      onChange={(e) => handleRemarkChange(item.id, e.target.value)}
                      placeholder="Specify exact defect observation, reading or location on shop floor..."
                      className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none bg-white text-slate-800 transition-all ${
                        isMissingRemark && hasError
                          ? 'border-rose-500 ring-2 ring-rose-200'
                          : 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      }`}
                    />
                  </div>

                  {/* Photo Evidence Capture */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-indigo-600" />
                        Defect Photos ({photos.length}/5)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Works Offline &bull; Stored locally
                      </span>
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={(el) => (fileInputRefs.current[item.id] = el)}
                      onChange={(e) => handlePhotoCapture(item.id, e)}
                      className="hidden"
                      disabled={photos.length >= 5}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      {photos.length < 5 && (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-800 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                        >
                          <Camera className="w-4 h-4 text-indigo-600" />
                          Add Photo / Camera
                        </button>
                      )}

                      {photos.map((photo) => {
                        const isUploading = photo.status === 'UPLOADING';
                        const isError = photo.status === 'ERROR';
                        const isUploaded = photo.status === 'UPLOADED';

                        return (
                          <div
                            key={photo.tempId}
                            className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-sm"
                          >
                            <img
                              src={photo.previewUrl}
                              alt="Defect Preview"
                              className="w-full h-full object-cover"
                            />

                            {isUploading && (
                              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                                <Loader2 className="w-5 h-5 animate-spin text-white" />
                                <span className="text-[9px] font-bold mt-0.5">Uploading</span>
                              </div>
                            )}

                            {isError && (
                              <div className="absolute inset-0 bg-rose-900/80 flex flex-col items-center justify-center text-white p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => uploadSinglePhoto(item.id, photo)}
                                  className="text-[10px] font-bold bg-white text-rose-800 px-1.5 py-0.5 rounded shadow"
                                >
                                  Retry
                                </button>
                              </div>
                            )}

                            {!isUploading && (
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(item.id, photo.tempId)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-md opacity-90 hover:opacity-100 hover:scale-110 transition-all"
                                title="Remove photo"
                              >
                                ✕
                              </button>
                            )}

                            {isUploaded && (
                              <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shadow">
                                ✓
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-3 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 font-semibold">
              {invalidItemIds.length === 0
                ? 'All checklist items complete'
                : `${invalidItemIds.length} item(s) pending`}
            </p>
            <p className="text-sm font-bold text-slate-800">
              {failedCount > 0 ? (
                <span className="text-rose-600">{failedCount} Defect(s) flagged</span>
              ) : (
                <span className="text-emerald-600">Zero Defects</span>
              )}
            </p>
          </div>

          <Button
            size="lg"
            variant={isFormValid ? 'primary' : 'secondary'}
            icon={<Send className="w-4 h-4" />}
            onClick={handleReviewClick}
            disabled={isAnyPhotoUploading}
            className="min-w-[170px]"
          >
            {isAnyPhotoUploading ? 'Uploading Photos...' : 'Review & Submit'}
          </Button>
        </div>
      </div>

      {/* Pre-Submit Review Summary Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900">Review Audit Summary</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                {schedule?.product}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                <p className="text-2xl font-black text-slate-800">{totalItems}</p>
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Items</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
                <p className="text-2xl font-black text-emerald-700">{passedCount}</p>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase">Passed</p>
              </div>
              <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200">
                <p className="text-2xl font-black text-rose-700">{failedCount}</p>
                <p className="text-[11px] font-semibold text-rose-600 uppercase">Failed (NCs)</p>
              </div>
            </div>

            {failedCount > 0 ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Defects by Severity:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-2 text-center">
                    <span className="text-base font-black text-amber-900">{minorCount}</span>
                    <p className="text-[10px] font-bold text-amber-800">MINOR</p>
                  </div>
                  <div className="bg-orange-100/70 border border-orange-300 rounded-xl p-2 text-center">
                    <span className="text-base font-black text-orange-900">{majorCount}</span>
                    <p className="text-[10px] font-bold text-orange-800">MAJOR</p>
                  </div>
                  <div className="bg-rose-100/70 border border-rose-300 rounded-xl p-2 text-center">
                    <span className="text-base font-black text-rose-900">{criticalCount}</span>
                    <p className="text-[10px] font-bold text-rose-800">CRITICAL</p>
                  </div>
                </div>
                {!isOnline && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg font-medium flex items-center gap-1.5 mt-2">
                    <CloudOff className="w-4 h-4 shrink-0 text-amber-600" />
                    Offline: Inspection will be stored in local queue and auto-synced.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 font-medium">
                All checklist criteria PASSED. Zero defects will be recorded.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
              >
                Back & Edit
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmSubmit}
                loading={submitting}
                icon={isOnline ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              >
                {isOnline ? 'Confirm & Submit' : 'Save Offline & Sync'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Success Modal (Handles Online and Offline outcomes) */}
      {submissionResult && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-inner ${
                submissionResult.isOfflineSaved
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {submissionResult.isOfflineSaved ? <Save className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900">
                {submissionResult.isOfflineSaved
                  ? 'Saved Offline!'
                  : 'Inspection Submitted!'}
              </h2>
              <p className="text-xs text-slate-500">
                {submissionResult.isOfflineSaved
                  ? 'Stored safely in your device’s local IndexedDB queue.'
                  : `Audit for ${schedule?.product} completed successfully.`}
              </p>
            </div>

            {submissionResult.isOfflineSaved ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <CloudOff className="w-5 h-5 text-amber-700" />
                  <span>Auto-Sync is Armed</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  As soon as your phone or tablet reconnects to shop-floor WiFi or cellular data, AuditPulse 360 will automatically upload defect photos and submit this inspection.
                </p>
              </div>
            ) : submissionResult.ncCount > 0 ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <span>{submissionResult.ncCount} Non-Conformance(s) Auto-Raised</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  NC tickets dispatched to Auditee. Action plan (CAPA) is required per SLA target dates.
                </p>
                <div className="pt-2 border-t border-rose-200/60 space-y-1">
                  {submissionResult.ncs?.map((nc) => (
                    <div key={nc.id} className="text-[11px] flex items-center justify-between font-mono text-slate-700">
                      <span>{nc.ncNo}</span>
                      <span className="font-bold text-rose-600">{nc.severity}</span>
                      <span>Target: {nc.targetDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-800 font-medium">
                100% Pass rate! Zero Non-Conformances recorded. Schedule status marked DONE.
              </div>
            )}

            <Button
              size="lg"
              variant="primary"
              className="w-full"
              onClick={() => router.push('/inspect')}
            >
              Back to Assigned Audits
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
