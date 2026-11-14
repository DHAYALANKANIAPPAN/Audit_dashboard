'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMySchedules, startSchedule, getChecklist } from '../../lib/api';
import { getQueueCount, initBackgroundSync } from '../../lib/offlineQueue';
import { Button, Badge, Spinner, Toast } from '../../components/common';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';

export default function InspectListPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load
    loadSchedules();
    updatePendingQueueCount();

    // Initialize auto background sync engine
    const cleanupSync = initBackgroundSync(({ syncedCount, errors }) => {
      updatePendingQueueCount();
      if (syncedCount > 0) {
        setToastMessage({
          text: `Auto-Sync: Synced ${syncedCount} inspection(s) to server successfully!`,
          type: 'success'
        });
        loadSchedules();
      }
      if (errors && errors.length > 0) {
        setToastMessage({
          text: `${errors.length} inspection(s) had server validation errors. Check logs.`,
          type: 'warning'
        });
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupSync();
    };
  }, []);

  async function updatePendingQueueCount() {
    try {
      const count = await getQueueCount();
      setQueuedCount(count);
    } catch (e) {
      console.warn('Could not read queue count:', e);
    }
  }

  async function loadSchedules() {
    setLoading(true);
    try {
      const data = await getMySchedules();
      setSchedules(data || []);

      // Step 5 Prefetch: Prefetch checklists for each assigned audit so they work 100% offline
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((sched) => {
          if (sched.auditType) {
            getChecklist(sched.auditType).catch(() => {});
          }
          // Prefetch route in Next.js
          router.prefetch(`/inspect/${sched.id}`);
        });
      }
    } catch (err) {
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartAudit(schedule) {
    if (schedule.status === 'PLANNED') {
      try {
        await startSchedule(schedule.id);
      } catch (e) {
        // Safe offline skip if network fails
        console.warn('Offline: Deferred start schedule call', e);
      }
    }
    router.push(`/inspect/${schedule.id}`);
  }

  const filtered = schedules.filter((s) => {
    if (filterStatus === 'ALL') return true;
    return s.status === filterStatus;
  });

  const totalCount = schedules.length;
  const completedCount = schedules.filter((s) => s.status === 'DONE').length;
  const inProgressCount = schedules.filter((s) => s.status === 'IN_PROGRESS').length;
  const plannedCount = schedules.filter((s) => s.status === 'PLANNED').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DONE':
        return <Badge variant="success">Completed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>;
      case 'MISSED':
        return <Badge variant="danger">Missed</Badge>;
      default:
        return <Badge variant="info">Planned</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    if (type === 'PRODUCT') {
      return <Badge variant="purple" size="sm">Product Audit</Badge>;
    }
    return <Badge variant="info" size="sm">Revalidation Audit</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Top Mobile-First Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">AuditPulse 360</h1>
              <p className="text-xs text-slate-500 font-medium">Shop-Floor Inspector &bull; Bhava</p>
            </div>
          </div>

          {/* Network & Offline Queue Status Badge (Item 7) */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isOnline
                  ? queuedCount > 0
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isOnline ? (
                queuedCount > 0 ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <Wifi className="w-3.5 h-3.5" />
                )
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              {isOnline
                ? queuedCount > 0
                  ? `Syncing (${queuedCount} queued)`
                  : 'Online'
                : queuedCount > 0
                ? `Offline: ${queuedCount} saved, will sync`
                : 'Offline Mode'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Date & Shift Summary Banner */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Today: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Today's Assigned Audits</h2>
            <p className="text-xs sm:text-sm text-indigo-100 mt-1">
              Complete assigned shop-floor audits on time. Works 100% offline in dead zones.
            </p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-indigo-700/60 text-center">
              <div>
                <p className="text-lg sm:text-2xl font-black">{totalCount}</p>
                <p className="text-[10px] sm:text-xs text-indigo-200 uppercase font-semibold">Total</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-black text-amber-300">{plannedCount}</p>
                <p className="text-[10px] sm:text-xs text-indigo-200 uppercase font-semibold">Planned</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-black text-blue-300">{inProgressCount}</p>
                <p className="text-[10px] sm:text-xs text-indigo-200 uppercase font-semibold">In Progress</p>
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-black text-emerald-300">{completedCount}</p>
                <p className="text-[10px] sm:text-xs text-indigo-200 uppercase font-semibold">Done</p>
              </div>
            </div>
          </div>
          <div className="absolute right-0 -bottom-6 opacity-10 pointer-events-none">
            <Sparkles className="w-48 h-48" />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {['ALL', 'PLANNED', 'IN_PROGRESS', 'DONE'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Audits' : st === 'IN_PROGRESS' ? 'In Progress' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Audit Cards List */}
        {loading ? (
          <div className="py-12 bg-white rounded-2xl border border-slate-200">
            <Spinner size="lg" label="Loading today's assigned audits..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Audits Assigned</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filterStatus === 'ALL'
                ? "You have completed all audits or none are scheduled for today's shift roster."
                : `No audits found with status "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleStartAudit(item)}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer active:scale-[0.99] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {getTypeBadge(item.auditType)}
                    <Badge variant="default" size="sm">
                      <Clock className="w-3 h-3 mr-1 text-slate-500" /> Shift {item.shift}
                    </Badge>
                    {getStatusBadge(item.status)}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{item.product}</h3>
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-0.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {item.line} &bull; {item.department}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <span className="text-xs text-slate-400 font-mono">ID: {item.id}</span>
                  <Button
                    size="sm"
                    variant={item.status === 'DONE' ? 'secondary' : 'primary'}
                    icon={item.status === 'DONE' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <PlayCircle className="w-4 h-4" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartAudit(item);
                    }}
                  >
                    {item.status === 'DONE' ? 'Review' : item.status === 'IN_PROGRESS' ? 'Resume' : 'Start Inspection'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
