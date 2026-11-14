'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchApi } from '@/lib/api';

const STATUS_COLORS = {
  Open: '#3b82f6', // blue
  'In Progress': '#f59e0b', // amber
  Overdue: '#ef4444', // red
  Closed: '#10b981', // emerald
};

const AGING_COLORS = ['#38bdf8', '#818cf8', '#f59e0b', '#f43f5e'];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filter States
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [line, setLine] = useState('');
  const [shift, setShift] = useState('');
  const [department, setDepartment] = useState('');

  // Data State
  const [data, setData] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (line) params.append('line', line);
      if (shift) params.append('shift', shift);
      if (department) params.append('department', department);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchApi(`/analytics/summary${qs}`);
      setData(res);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch analytics summary:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to, line, shift, department]);

  useEffect(() => {
    setMounted(true);
    fetchSummary();
  }, [fetchSummary]);

  // Auto-refresh interval (every 10 seconds per requirements)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchSummary();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSummary]);

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setLine('');
    setShift('');
    setDepartment('');
  };

  if (!mounted) return null;

  // Prepare chart data sets
  const completionData = data?.completion?.byLine?.map((l) => ({
    name: l.line.replace('Line ', 'L').split(' - ')[0],
    fullName: l.line,
    Planned: l.planned,
    Completed: l.executed,
    Rate: l.percent,
  })) || [];

  const pieData = data?.nc
    ? [
        { name: 'Open', value: data.nc.open },
        { name: 'In Progress', value: data.nc.inProgress },
        { name: 'Overdue', value: data.nc.overdue },
        { name: 'Closed', value: data.nc.closed },
      ].filter((item) => item.value > 0)
    : [];

  const agingData = data?.aging
    ? [
        { name: '< 7 Days', count: data.aging.lt7, fill: AGING_COLORS[0] },
        { name: '7-15 Days', count: data.aging.d7to15, fill: AGING_COLORS[1] },
        { name: '15-30 Days', count: data.aging.d15to30, fill: AGING_COLORS[2] },
        { name: '> 30 Days', count: data.aging.gt30, fill: AGING_COLORS[3] },
      ]
    : [];

  const failureData = data?.recurringFailures?.map((f) => ({
    name: f.item.length > 28 ? `${f.item.substring(0, 28)}...` : f.item,
    fullItem: f.item,
    line: f.line,
    Count: f.count,
  })) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header & Live Auto-refresh Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>📊</span> Executive Quality Analytics
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Stream
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Real-time compliance monitoring, audit completion KPIs, and NC resolution metrics (ISO 9001 / IATF 16949).
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 font-mono">Last refreshed:</p>
            <p className="text-xs font-mono text-slate-400">{lastRefreshed.toLocaleTimeString()}</p>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              autoRefresh
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 hover:bg-blue-600/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {autoRefresh ? '⏱️ Auto 10s: ON' : '⏱️ Auto 10s: PAUSED'}
          </button>

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Date Range:</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Line:</span>
          <select
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Lines</option>
            <option value="L1-CHASSIS">Line 1 - Chassis</option>
            <option value="L2-POWERTRAIN">Line 2 - Powertrain</option>
            <option value="L3-FINAL">Line 3 - Final Assembly</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Shift:</span>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Shifts</option>
            <option value="A">Shift A</option>
            <option value="B">Shift B</option>
            <option value="C">Shift C</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Department:</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Departments</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Quality Assurance">Quality Assurance</option>
            <option value="Engineering">Engineering</option>
          </select>
        </div>

        {(from || to || line || shift || department) && (
          <button
            onClick={resetFilters}
            className="ml-auto text-xs text-rose-400 hover:text-rose-300 font-medium underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* KPI Summary Cards (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Completion % */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-blue-900/40 relative overflow-hidden">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 block">Audit Completion</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-white">{data?.completion?.percent || 0}%</span>
            <span className="text-[11px] text-slate-400">
              ({data?.completion?.executed || 0}/{data?.completion?.planned || 0})
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, data?.completion?.percent || 0)}%` }}
            ></div>
          </div>
        </div>

        {/* Open NCs */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Active Open NCs</span>
          <span className="text-2xl font-bold font-mono text-white mt-2 block">{data?.nc?.open || 0}</span>
          <p className="text-[11px] text-slate-500 mt-2">Awaiting auditee containment</p>
        </div>

        {/* Overdue NCs */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-rose-900/50 bg-rose-950/10">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Overdue NCs
          </span>
          <span className="text-2xl font-bold font-mono text-rose-400 mt-2 block">{data?.nc?.overdue || 0}</span>
          <p className="text-[11px] text-rose-300/80 mt-2">Breached SLA target date</p>
        </div>

        {/* Closed NCs */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-900/40">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">Resolved / Closed</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-2 block">{data?.nc?.closed || 0}</span>
          <p className="text-[11px] text-slate-500 mt-2">Auditing Head signed-off</p>
        </div>

        {/* On-Time Closure % */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-indigo-900/40">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 block">On-Time Closure</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-white">{data?.onTimeClosure?.percent || 0}%</span>
            <span className="text-[11px] text-slate-400">
              ({data?.onTimeClosure?.closedOnTime || 0}/{data?.onTimeClosure?.totalClosed || 0})
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, data?.onTimeClosure?.percent || 0)}%` }}
            ></div>
          </div>
        </div>

        {/* MTTC */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">MTTC (Mean Days)</span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-bold font-mono text-white">{data?.mttcDays || 0}</span>
            <span className="text-xs text-slate-400">days</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Average time to close</p>
        </div>
      </div>

      {/* Row 1: Charts (Bar: Completion by Line & Donut: NC Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion by Line (2 cols) */}
        <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Audit Execution by Production Line</h2>
              <p className="text-xs text-slate-400">Planned vs. Completed audits per manufacturing line</p>
            </div>
            <span className="text-xs font-mono text-blue-400 font-semibold">
              Plant Avg: {data?.completion?.percent || 0}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Planned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NC Status Breakdown Donut (1 col) */}
        <div className="lg:col-span-1 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">NC Lifecycle Status Distribution</h2>
            <p className="text-xs text-slate-400 mb-2">Total raised: {data?.nc?.total || 0} defects</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            {pieData.length === 0 ? (
              <span className="text-xs text-slate-500">No defect tickets recorded</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-800/80">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[item.name] || '#64748b' }}
                ></span>
                <span className="text-slate-400 text-[11px] truncate">{item.name}:</span>
                <span className="font-mono font-bold text-white text-[11px]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Charts (Bar: Aging Buckets & Bar: Recurring Failures) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Buckets */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Open NC Aging Analysis</h2>
              <p className="text-xs text-slate-400">Duration open NCs have remained active without closure</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Active: {data?.nc?.total - data?.nc?.closed || 0} NCs
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {agingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recurring Failures */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Top Recurring Defect Checklist Items</h2>
              <p className="text-xs text-slate-400">Frequently failed inspection points across stations</p>
            </div>
          </div>

          <div className="h-56 w-full">
            {failureData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No recurring failures identified
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={failureData}
                  margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} width={150} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    formatter={(val, name, item) => [`${val} occurrences`, `${item.payload.line}`]}
                  />
                  <Bar dataKey="Count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Auditor Workload & Pending Approvals List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Auditor Workload Table (2 cols) */}
        <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Auditor Workload & Execution Performance</h2>
            <p className="text-xs text-slate-400">Schedule balancing across certified plant auditors</p>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Auditor Name</th>
                  <th className="py-2.5 px-4 text-center">Assigned Audits</th>
                  <th className="py-2.5 px-4 text-center">Completed</th>
                  <th className="py-2.5 px-4 text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {data?.auditorWorkload?.map((w, idx) => {
                  const rate = w.planned > 0 ? ((w.done / w.planned) * 100).toFixed(1) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-sans font-medium text-white">{w.auditor}</td>
                      <td className="py-2.5 px-4 text-center">{w.planned}</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold">{w.done}</td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Approvals & Effort Saved Summary (1 col) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Pending Sign-off Box */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white">Pending Approval Queues</h2>
            <div className="space-y-3">
              <a
                href="/approvals"
                className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition block group"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">Stage 1</span>
                  <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition">
                    Auditor On-site Verification
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {data?.pendingApprovals?.verification || 0}
                </span>
              </a>

              <a
                href="/approvals"
                className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition block group"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">Stage 2</span>
                  <span className="text-xs font-semibold text-white group-hover:text-blue-400 transition">
                    Auditing Head Final Sign-off
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {data?.pendingApprovals?.headSignoff || 0}
                </span>
              </a>
            </div>
          </div>

          {/* Effort Saved Impact Card */}
          <div className="bg-gradient-to-br from-slate-950 to-blue-950/40 p-6 rounded-2xl border border-blue-900/40">
            <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <span>⚡</span> Quality 4.0 Efficiency Impact
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-white">~36 hrs</span>
              <span className="text-xs text-blue-300 font-semibold">saved / week (~83%)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Automated roster balancing, digital checklist execution, auto-ticket generation, and instant KPI reporting eliminate 36+ hours of spreadsheet maintenance per week.
            </p>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              *Based on plant baseline audit timing model documented in docs/impact.md
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
