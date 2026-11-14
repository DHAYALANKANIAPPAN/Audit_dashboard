'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/common/AppLayout';
import { getAuditHistory, getAuditTimeline } from '@/lib/api';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ totalAudits: 0, totalNcs: 0, openNcs: 0, closedNcs: 0, criticalNcs: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [auditType, setAuditType] = useState('');
  const [line, setLine] = useState('');
  const [shift, setShift] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Timeline Drawer State
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState(null);

  // Load audit history
  const loadHistory = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await getAuditHistory({
        q: searchTerm,
        auditType,
        line,
        shift,
        status,
        severity,
        from: fromDate,
        to: toDate,
        page,
        limit: 10,
      });

      if (res && res.data) {
        setData(res.data);
        setSummary(res.summary || {});
        setPagination(res.pagination || { page: 1, limit: 10, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, auditType, line, shift, status, severity, fromDate, toDate]);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  // Open timeline drilldown drawer
  const handleOpenTimeline = async (scheduleId) => {
    setSelectedScheduleId(scheduleId);
    setDrawerOpen(true);
    setTimelineLoading(true);
    try {
      const res = await getAuditTimeline(scheduleId);
      setTimelineData(res);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimelineData(null);
    setSelectedScheduleId(null);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setAuditType('');
    setLine('');
    setShift('');
    setStatus('');
    setSeverity('');
    setFromDate('');
    setToDate('');
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit History & NC Traceability</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                IATF 16949 / ISO 9001 Trail
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              End-to-end digital lifecycle archive — from shift schedule to 5-Why CAPA and Two-Tier sign-offs
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadHistory(pagination.page)}
              className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
            >
              <svg className="w-4 h-4 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Summary Ribbons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Audits</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{pagination.total}</span>
              <span className="text-xs text-blue-600 font-medium">Logged</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">NCs Logged</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{summary.totalNcs || 0}</span>
              <span className="text-xs text-purple-600 font-medium">Traceable</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open NCs</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-600">{summary.openNcs || 0}</span>
              <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Action Req</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Critical Defects</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-red-600">{summary.criticalNcs || 0}</span>
              <span className="text-xs text-red-700 bg-red-50 px-1.5 py-0.5 rounded">High Severity</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Closed & Verified</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-600">{summary.closedNcs || 0}</span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Compliant</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Free text search */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by NC ticket (e.g. NC-2026-0001), auditor, line, product, remark..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Quick Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={auditType}
                onChange={(e) => setAuditType(e.target.value)}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="PRODUCT">Product Audit</option>
                <option value="PROCESS">Process Audit</option>
                <option value="LAYERED">Layered Audit</option>
                <option value="REVALIDATION">Revalidation</option>
              </select>

              <select
                value={line}
                onChange={(e) => setLine(e.target.value)}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Lines</option>
                <option value="LINE-1">Line 1 - Engine</option>
                <option value="LINE-2">Line 2 - Transmission</option>
                <option value="LINE-3">Line 3 - Body & Paint</option>
              </select>

              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Shifts</option>
                <option value="SHIFT_A">Shift A (Morning)</option>
                <option value="SHIFT_B">Shift B (Evening)</option>
                <option value="SHIFT_C">Shift C (Night)</option>
              </select>

              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severity</option>
                <option value="CRITICAL">Critical NCs</option>
                <option value="MAJOR">Major NCs</option>
                <option value="MINOR">Minor NCs</option>
              </select>
            </div>

            {/* Clear Filters */}
            {(searchTerm || auditType || line || shift || status || severity || fromDate || toDate) && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Audit Register ({pagination.total} records found)
            </h2>
            <span className="text-xs text-slate-400">Page {pagination.page} of {pagination.totalPages}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Shift</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Line / Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Auditor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Inspection Findings</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">NC Tickets Raised</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <p className="text-xs">Loading audit history & trace records...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <svg className="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-600">No matching audit records found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or resetting filters</p>
                    </td>
                  </tr>
                ) : (
                  data.map((audit) => (
                    <tr
                      key={audit.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => handleOpenTimeline(audit.id)}
                    >
                      {/* Date & Shift */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {new Date(audit.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-700">
                          {audit.shift.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Line & Product */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800 text-xs">{audit.line.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Part: {audit.product}</div>
                      </td>

                      {/* Audit Type */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                          {audit.auditType}
                        </span>
                      </td>

                      {/* Auditor */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800">{audit.auditor.name}</div>
                        <div className="text-[10px] text-slate-400">{audit.auditor.role}</div>
                      </td>

                      {/* Inspection Summary */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {audit.inspectionSummary ? (
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-emerald-600">
                                {audit.inspectionSummary.passCount} PASS
                              </span>
                              {audit.inspectionSummary.failCount > 0 && (
                                <span className="text-xs font-bold text-red-600">
                                  {audit.inspectionSummary.failCount} FAIL
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Score: {audit.inspectionSummary.scorePct}% ({audit.inspectionSummary.totalItems} items)
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No checklist filed</span>
                        )}
                      </td>

                      {/* NC Tickets */}
                      <td className="px-4 py-3.5">
                        {audit.ncs.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {audit.ncs.map((nc) => (
                              <span
                                key={nc.id}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                  nc.severity === 'CRITICAL'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : nc.severity === 'MAJOR'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                }`}
                              >
                                {nc.ncNo}
                                {nc.isOverdue && <span className="ml-1 text-[9px] text-red-600 font-bold">!</span>}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">None (Clean Pass)</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            audit.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : audit.status === 'MISSED'
                              ? 'bg-red-100 text-red-800'
                              : audit.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {audit.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTimeline(audit.id);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                        >
                          View Timeline &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <div>
              Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} audits
            </div>
            <div className="flex space-x-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadHistory(pagination.page - 1)}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-semibold text-slate-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadHistory(pagination.page + 1)}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* 6-Stage Lifecycle Timeline Flyout Drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm transition-opacity flex justify-end">
            <div className="w-full max-w-3xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50 sticky top-0 z-10 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-blue-100 text-blue-800 rounded">
                      AUDIT LIFECYCLE
                    </span>
                    <span className="text-xs text-slate-500">
                      ID: {selectedScheduleId ? selectedScheduleId.slice(0, 8) : ''}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {timelineData ? `${timelineData.line.name} — ${timelineData.product}` : 'Audit Traceability Trail'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 space-y-6 flex-1">
                {timelineLoading ? (
                  <div className="py-20 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-sm">Fetching end-to-end timeline drilldown...</p>
                  </div>
                ) : !timelineData ? (
                  <div className="py-20 text-center text-slate-400">
                    <p className="text-sm">Timeline details could not be loaded.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Stepper Trail */}
                    <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8">
                      {/* Stage 1: Plan & Scheduled */}
                      <div className="relative">
                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                          1
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">Stage 1: Audit Planned & Scheduled</h4>
                            <span className="text-[11px] text-slate-500">
                              {new Date(timelineData.scheduleDate).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                          <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1 text-slate-600">
                            <div><span className="font-semibold text-slate-700">Line:</span> {timelineData.line.name} ({timelineData.line.code})</div>
                            <div><span className="font-semibold text-slate-700">Department:</span> {timelineData.department.name}</div>
                            <div><span className="font-semibold text-slate-700">Shift:</span> {timelineData.shift.replace('_', ' ')}</div>
                            <div><span className="font-semibold text-slate-700">Assigned Auditor:</span> {timelineData.auditor.name} ({timelineData.auditor.email})</div>
                          </div>
                        </div>
                      </div>

                      {/* Stage 2: Shop-floor Inspection */}
                      <div className="relative">
                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                          2
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">Stage 2: Shop-Floor Inspection</h4>
                            <span className="text-[11px] font-semibold text-emerald-700">
                              {timelineData.timeline[1]?.status}
                            </span>
                          </div>

                          {timelineData.timeline[1]?.details ? (
                            <div className="mt-2 p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 text-xs space-y-3">
                              <div className="flex items-center space-x-4">
                                <div><span className="font-semibold text-emerald-800">Pass:</span> {timelineData.timeline[1].details.passCount}</div>
                                <div><span className="font-semibold text-red-800">Fail:</span> {timelineData.timeline[1].details.failCount}</div>
                                <div><span className="font-semibold text-slate-600">NA:</span> {timelineData.timeline[1].details.naCount}</div>
                                <div className="text-[11px] text-slate-400">
                                  Submitted: {new Date(timelineData.timeline[1].details.submittedAt).toLocaleTimeString()}
                                </div>
                              </div>

                              {/* Checklist item findings */}
                              <div className="space-y-1.5 pt-2 border-t border-emerald-100">
                                <span className="font-semibold text-slate-700 text-[11px]">Checklist Items & Remarks:</span>
                                {timelineData.timeline[1].details.items.map((it) => (
                                  <div key={it.id} className="p-2 bg-white rounded border border-slate-200 text-[11px] space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-slate-800">{it.itemText}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${it.result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        {it.result}
                                      </span>
                                    </div>
                                    {it.remark && (
                                      <p className="text-slate-500 italic">&ldquo;{it.remark}&rdquo;</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic mt-1">Inspection not yet submitted.</p>
                          )}
                        </div>
                      </div>

                      {/* Stage 3: NC Ticketing */}
                      <div className="relative">
                        <div className={`absolute -left-[33px] top-0 w-6 h-6 rounded-full ${timelineData.timeline[2]?.ncs.length > 0 ? 'bg-red-600' : 'bg-slate-400'} text-white flex items-center justify-center text-xs font-bold ring-4 ring-white`}>
                          3
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">
                              Stage 3: Non-Conformance Ticketing ({timelineData.timeline[2]?.ncs.length || 0})
                            </h4>
                            <span className="text-[11px] text-slate-500">
                              {timelineData.timeline[2]?.status}
                            </span>
                          </div>

                          {timelineData.timeline[2]?.ncs.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {timelineData.timeline[2].ncs.map((nc) => (
                                <div key={nc.id} className="p-3 bg-red-50/50 rounded-lg border border-red-100 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono font-bold text-red-900">{nc.ncNo}</span>
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-200 text-red-900">
                                        {nc.severity}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500">
                                      Target SLA: {new Date(nc.targetDate).toLocaleDateString('en-GB')}
                                    </span>
                                  </div>
                                  <p className="text-slate-700">{nc.checklistItemText}</p>
                                  <div className="text-[11px] text-slate-500">
                                    Auditee Assigned: <span className="font-medium text-slate-800">{nc.auditee?.name || 'Line Supervisor'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-emerald-600 font-medium mt-1">Zero Non-Conformances raised (Clean Audit).</p>
                          )}
                        </div>
                      </div>

                      {/* Stage 4: CAPA RCA */}
                      <div className="relative">
                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                          4
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">Stage 4: CAPA Root-Cause Analysis</h4>
                            <span className="text-[11px] font-semibold text-purple-700">
                              {timelineData.timeline[3]?.status}
                            </span>
                          </div>

                          {timelineData.timeline[3]?.capas?.length > 0 ? (
                            <div className="mt-2 space-y-3">
                              {timelineData.timeline[3].capas.map((capa) => (
                                <div key={capa.capaId} className="p-3 bg-purple-50/50 rounded-lg border border-purple-100 text-xs space-y-2">
                                  <div className="flex items-center justify-between font-semibold text-purple-900">
                                    <span>Ticket: {capa.ncNo}</span>
                                    <span className="text-[10px] bg-purple-200 px-1.5 py-0.5 rounded">
                                      {capa.method} Analysis
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Root Cause:</span>
                                    <p className="text-slate-600 mt-0.5 italic">{capa.rootCause}</p>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Corrective Action:</span>
                                    <p className="text-slate-600 mt-0.5">{capa.corrective}</p>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Preventive Action:</span>
                                    <p className="text-slate-600 mt-0.5">{capa.preventive}</p>
                                  </div>
                                  <div className="text-[10px] text-slate-400 pt-1 border-t border-purple-100">
                                    Owner: {capa.owner?.name} | Submitted: {new Date(capa.submittedAt).toLocaleDateString('en-GB')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic mt-1">No CAPA submissions required or pending.</p>
                          )}
                        </div>
                      </div>

                      {/* Stage 5: Two-Tier Approvals */}
                      <div className="relative">
                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                          5
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">Stage 5: Two-Tier Verification & Approvals</h4>
                            <span className="text-[11px] font-semibold text-indigo-700">
                              {timelineData.timeline[4]?.status}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                              <span className="font-semibold text-indigo-900">Tier 1: Line Supervisor</span>
                              <div className="mt-1 flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${timelineData.timeline[4]?.tier1Signoffs > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                <span className="text-[11px] text-slate-600">
                                  {timelineData.timeline[4]?.tier1Signoffs > 0 ? 'Approved & Signed' : 'Pending Sign-off'}
                                </span>
                              </div>
                            </div>

                            <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                              <span className="font-semibold text-indigo-900">Tier 2: Quality Manager</span>
                              <div className="mt-1 flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${timelineData.timeline[4]?.tier2Signoffs > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                <span className="text-[11px] text-slate-600">
                                  {timelineData.timeline[4]?.tier2Signoffs > 0 ? 'Approved & Signed' : 'Pending Sign-off'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stage 6: Revalidation & Sign-Off */}
                      <div className="relative">
                        <div className={`absolute -left-[33px] top-0 w-6 h-6 rounded-full ${timelineData.timeline[5]?.isFullyCompliant ? 'bg-emerald-600' : 'bg-amber-500'} text-white flex items-center justify-center text-xs font-bold ring-4 ring-white`}>
                          6
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900">Stage 6: Revalidation & Final Closure</h4>
                            <span className={`text-[11px] font-bold ${timelineData.timeline[5]?.isFullyCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {timelineData.timeline[5]?.status}
                            </span>
                          </div>
                          <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600">
                            <p>
                              {timelineData.timeline[5]?.isFullyCompliant
                                ? 'All corrective actions and digital signatures verified. Audit lifecycle is complete and compliant with ISO 9001:2015 Clause 9.2.'
                                : 'Lifecycle is active. Awaiting outstanding CAPA resolutions or Tier 2 verification.'}
                            </p>
                            {timelineData.timeline[5]?.closedAt && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                Closed Date: {new Date(timelineData.timeline[5].closedAt).toLocaleDateString('en-GB')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                <span>Tamper-evident audit trail &bull; AuditPulse 360</span>
                <button
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 transition"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
