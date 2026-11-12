'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function CalendarPage() {
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [schedules, setSchedules] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null); // format: "2026-11-15"
  const [reassigningId, setReassigningId] = useState(null);
  const [selectedAuditorId, setSelectedAuditorId] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Load schedules for selected month
  const loadRoster = async () => {
    setLoading(true);
    try {
      const [rosterData, auditorsData] = await Promise.all([
        fetchApi(`/roster?month=${selectedMonth}`),
        fetchApi('/roster/auditors').catch(() => []),
      ]);
      setSchedules(Array.isArray(rosterData) ? rosterData : []);
      setAuditors(Array.isArray(auditorsData) ? auditorsData : []);
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [selectedMonth]);

  // Auto-generate roster
  const handleGenerateRoster = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/roster/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate roster');
      setToastMessage(data.message || `Scheduled ${data.generatedCount} audits!`);
      loadRoster();
    } catch (err) {
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Mark missed schedules
  const handleMarkMissed = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/roster/mark-missed`, { method: 'POST' });
      const data = await res.json();
      setToastMessage(data.message || 'Updated missed schedules.');
      loadRoster();
    } catch (err) {
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Handle reassign auditor
  const handleReassign = async (scheduleId) => {
    if (!selectedAuditorId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/schedules/${scheduleId}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditorId: selectedAuditorId }),
      });
      if (!res.ok) throw new Error('Reassignment failed');
      setReassigningId(null);
      setSelectedAuditorId('');
      setToastMessage('Auditor reassigned successfully!');
      loadRoster();
    } catch (err) {
      setToastMessage(`Reassignment error: ${err.message}`);
    } finally {
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Build calendar month grid
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1; // 0-indexed
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay(); // 0 = Sun, 1 = Mon...

  // Map schedules by date string "YYYY-MM-DD"
  const schedulesByDay = {};
  schedules.forEach((s) => {
    const dStr = s.date ? new Date(s.date).toISOString().split('T')[0] : '';
    if (!schedulesByDay[dStr]) schedulesByDay[dStr] = [];
    schedulesByDay[dStr].push(s);
  });

  const selectedDaySchedules = selectedDay ? (schedulesByDay[selectedDay] || []) : [];

  // KPI counts
  const totalCount = schedules.length;
  const plannedCount = schedules.filter((s) => s.status === 'PLANNED').length;
  const inProgressCount = schedules.filter((s) => s.status === 'IN_PROGRESS').length;
  const doneCount = schedules.filter((s) => s.status === 'DONE').length;
  const missedCount = schedules.filter((s) => s.status === 'MISSED').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>🗓️</span> Shift Roster & Calendar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Automated conflict-free auditor scheduling, shift balancing, and daily execution tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setSelectedDay(null);
            }}
            className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={handleGenerateRoster}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-blue-600/20"
          >
            <span>⚡</span>
            {actionLoading ? 'Balancing Roster...' : 'Auto-Generate Roster'}
          </button>
          <button
            onClick={handleMarkMissed}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            title="Scan past dates and mark overdue PLANNED audits as MISSED"
          >
            Check Missed
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-blue-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Quick KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Scheduled</span>
          <span className="text-xl font-bold text-white mt-1 block font-mono">{totalCount}</span>
        </div>
        <div className="p-4 bg-slate-950 rounded-xl border border-blue-900/40">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">Planned</span>
          <span className="text-xl font-bold text-blue-300 mt-1 block font-mono">{plannedCount}</span>
        </div>
        <div className="p-4 bg-slate-950 rounded-xl border border-amber-900/40">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-bold text-amber-300 mt-1 block font-mono">{inProgressCount}</span>
        </div>
        <div className="p-4 bg-slate-950 rounded-xl border border-emerald-900/40">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Completed</span>
          <span className="text-xl font-bold text-emerald-300 mt-1 block font-mono">{doneCount}</span>
        </div>
        <div className="p-4 bg-slate-950 rounded-xl border border-rose-900/40">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">Missed</span>
          <span className="text-xl font-bold text-rose-300 mt-1 block font-mono">{missedCount}</span>
        </div>
      </div>

      {/* Main Content Layout: Calendar Grid + Day Details Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month Grid (2 cols) */}
        <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              {new Date(year, monthIdx, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Planned</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Done</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Missed</span>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider py-1 border-b border-slate-800">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Blank offset cells for days before the 1st */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-24 bg-slate-900/20 rounded-xl border border-slate-900 opacity-30"></div>
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dStr = `${yearStr}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
              const daySchedules = schedulesByDay[dStr] || [];
              const isSelected = selectedDay === dStr;

              return (
                <div
                  key={dStr}
                  onClick={() => setSelectedDay(dStr)}
                  className={`h-24 p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/10'
                      : daySchedules.length > 0
                      ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-900/30 border-slate-900 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-bold ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>
                      {dayNum}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        {daySchedules.length}
                      </span>
                    )}
                  </div>

                  {/* Status badges summary */}
                  <div className="space-y-1">
                    {daySchedules.slice(0, 2).map((s) => {
                      const colorClass =
                        s.status === 'DONE'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : s.status === 'IN_PROGRESS'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : s.status === 'MISSED'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                      return (
                        <div
                          key={s.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-medium border ${colorClass}`}
                        >
                          Shift {s.shift}: {s.plan?.line?.name?.split('-')[0]?.trim() || 'Line'}
                        </div>
                      );
                    })}
                    {daySchedules.length > 2 && (
                      <span className="text-[9px] text-slate-500 font-mono block pl-1">
                        +{daySchedules.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Shift Roster Details Drawer (1 col) */}
        <div className="lg:col-span-1 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col">
          <div className="border-b border-slate-800 pb-4 mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋</span> Day Shift Roster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedDay
                ? new Date(selectedDay).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : 'Click any day on the calendar grid to inspect shift assignments'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {!selectedDay ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 p-6">
                <svg className="w-10 h-10 text-slate-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs">No day selected</p>
                <p className="text-[11px] text-slate-600 mt-1">Select a calendar date to view or reassign shift schedules.</p>
              </div>
            ) : selectedDaySchedules.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 p-6">
                <p className="text-xs">No audits scheduled for this date.</p>
                <p className="text-[11px] text-slate-600 mt-1">Click &quot;Auto-Generate Roster&quot; to schedule pending audits.</p>
              </div>
            ) : (
              selectedDaySchedules.map((s) => {
                const statusBadge =
                  s.status === 'DONE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : s.status === 'IN_PROGRESS'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : s.status === 'MISSED'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

                const isEditing = reassigningId === s.id;

                return (
                  <div key={s.id} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        Shift {s.shift}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusBadge}`}>
                        {s.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white">{s.plan?.line?.name}</h4>
                      <p className="text-[11px] text-slate-400">{s.plan?.product}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Assigned Auditor</span>
                        <span className="text-xs font-medium text-slate-200">{s.auditor?.name || 'Unassigned'}</span>
                      </div>

                      {!isEditing && (
                        <button
                          onClick={() => {
                            setReassigningId(s.id);
                            setSelectedAuditorId(s.auditorId);
                          }}
                          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                        >
                          Reassign
                        </button>
                      )}
                    </div>

                    {/* Reassign Selector */}
                    {isEditing && (
                      <div className="pt-2 space-y-2 border-t border-slate-800">
                        <select
                          value={selectedAuditorId}
                          onChange={(e) => setSelectedAuditorId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Select an auditor</option>
                          {auditors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.email})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReassign(s.id)}
                            className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setReassigningId(null)}
                            className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
