'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/common/AppLayout';
import { getNcs, submitCapa } from '@/lib/api';

export default function NCsPage() {
  const [loading, setLoading] = useState(true);
  const [ncs, setNcs] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, OPEN, SUBMITTED, OVERDUE, CLOSED
  const [severityFilter, setSeverityFilter] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [search, setSearch] = useState('');

  // CAPA Modal state
  const [selectedNc, setSelectedNc] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submittingCapa, setSubmittingCapa] = useState(false);
  const [why1, setWhy1] = useState('');
  const [why2, setWhy2] = useState('');
  const [why3, setWhy3] = useState('');
  const [why4, setWhy4] = useState('');
  const [why5, setWhy5] = useState('');
  const [corrective, setCorrective] = useState('');
  const [preventive, setPreventive] = useState('');
  const [capaTargetDate, setCapaTargetDate] = useState('');

  const loadNcs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab === 'OVERDUE') {
        params.overdue = 'true';
      } else if (activeTab !== 'ALL') {
        params.status = activeTab;
      }
      if (severityFilter) params.severity = severityFilter;
      if (lineFilter) params.lineId = lineFilter;
      if (search) params.search = search;

      const res = await getNcs(params);
      if (Array.isArray(res)) {
        setNcs(res);
      }
    } catch (err) {
      console.error('Failed to load NCs:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, severityFilter, lineFilter, search]);

  useEffect(() => {
    loadNcs();
  }, [loadNcs]);

  const handleOpenCapaModal = (nc) => {
    setSelectedNc(nc);
    setModalOpen(true);
    // Prefill if existing CAPA
    if (nc.capa) {
      try {
        const whys = JSON.parse(nc.capa.rootCause);
        if (Array.isArray(whys)) {
          setWhy1(whys[0] || '');
          setWhy2(whys[1] || '');
          setWhy3(whys[2] || '');
          setWhy4(whys[3] || '');
          setWhy5(whys[4] || '');
        } else {
          setWhy1(nc.capa.rootCause);
        }
      } catch {
        setWhy1(nc.capa.rootCause);
      }
      setCorrective(nc.capa.corrective || '');
      setPreventive(nc.capa.preventive || '');
      setCapaTargetDate(nc.capa.targetDate ? new Date(nc.capa.targetDate).toISOString().split('T')[0] : '');
    } else {
      setWhy1('');
      setWhy2('');
      setWhy3('');
      setWhy4('');
      setWhy5('');
      setCorrective('');
      setPreventive('');
      setCapaTargetDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    }
  };

  const handleCloseCapaModal = () => {
    setModalOpen(false);
    setSelectedNc(null);
  };

  const handleSubmitCapa = async (e) => {
    e.preventDefault();
    if (!selectedNc) return;

    const whys = [why1, why2, why3, why4, why5].filter(Boolean);
    if (whys.length === 0 || !corrective || !preventive) {
      alert('Please fill out at least 1 Root Cause statement, Corrective Action, and Preventive Action.');
      return;
    }

    setSubmittingCapa(true);
    try {
      await submitCapa(selectedNc.id, {
        rootCauseMethod: 'FIVE_WHY',
        rootCause: whys,
        corrective,
        preventive,
        targetDate: capaTargetDate,
      });
      alert(`CAPA for ${selectedNc.ncNo} successfully submitted for Tier 1 Auditor Verification!`);
      handleCloseCapaModal();
      loadNcs();
    } catch (err) {
      alert(`Failed to submit CAPA: ${err.message}`);
    } finally {
      setSubmittingCapa(false);
    }
  };

  // Metrics summary
  const totalCount = ncs.length;
  const openCount = ncs.filter((n) => n.status === 'OPEN' || n.status === 'IN_PROGRESS').length;
  const submittedCount = ncs.filter((n) => n.status === 'SUBMITTED' || n.status === 'VERIFIED').length;
  const overdueCount = ncs.filter((n) => n.isOverdue).length;
  const closedCount = ncs.filter((n) => n.status === 'CLOSED').length;

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Non-Conformance (NC) Registry</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded-full border border-red-300">
                Corrective Action Engine
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Shop-floor defect tickets, SLA escalation monitoring, and 5-Why CAPA resolution tracking
            </p>
          </div>

          <button
            onClick={loadNcs}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition self-start sm:self-auto"
          >
            <svg className="w-4 h-4 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          {[
            { id: 'ALL', label: 'All Tickets', count: totalCount },
            { id: 'OPEN', label: 'Open / In Progress', count: openCount },
            { id: 'SUBMITTED', label: 'Pending Approval', count: submittedCount },
            { id: 'OVERDUE', label: 'Overdue SLA', count: overdueCount, highlight: true },
            { id: 'CLOSED', label: 'Closed & Verified', count: closedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tab.highlight && tab.count > 0
                    ? 'bg-red-500 text-white'
                    : activeTab === tab.id
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Filter Bar */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NC ticket, finding text, line, or auditee..."
            className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
          </select>
        </div>

        {/* NC Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">NC Ticket</th>
                  <th className="px-4 py-3 text-left">Severity</th>
                  <th className="px-4 py-3 text-left">Line / Station</th>
                  <th className="px-4 py-3 text-left">Defect Finding</th>
                  <th className="px-4 py-3 text-left">Auditee</th>
                  <th className="px-4 py-3 text-left">Target SLA</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">CAPA Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <p className="text-xs">Loading NC tickets...</p>
                    </td>
                  </tr>
                ) : ncs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-medium text-slate-600">No NC tickets found for this view</p>
                    </td>
                  </tr>
                ) : (
                  ncs.map((nc) => (
                    <tr key={nc.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-slate-900 text-xs">
                        {nc.ncNo}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            nc.severity === 'CRITICAL'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : nc.severity === 'MAJOR'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                          }`}
                        >
                          {nc.severity}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-700">
                        {nc.line?.name || 'Line 1'}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-800 max-w-xs">
                        <div className="line-clamp-2">{nc.checklistItem?.itemText || nc.remark || 'Observed defect'}</div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        {nc.auditee?.name || 'Unassigned'}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className={nc.isOverdue ? 'text-red-600 font-bold' : 'text-slate-700'}>
                          {new Date(nc.targetDate).toLocaleDateString('en-GB')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {nc.isOverdue ? '⚠️ SLA BREACHED' : `${nc.daysRemaining} days left`}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            nc.status === 'CLOSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : nc.status === 'VERIFIED'
                              ? 'bg-indigo-100 text-indigo-800'
                              : nc.status === 'SUBMITTED'
                              ? 'bg-purple-100 text-purple-800'
                              : nc.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {nc.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                        {nc.status !== 'CLOSED' ? (
                          <button
                            onClick={() => handleOpenCapaModal(nc)}
                            className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition"
                          >
                            {nc.hasCapa ? 'Update CAPA' : 'Submit CAPA'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">✓ Closed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5-Why CAPA Modal */}
        {modalOpen && selectedNc && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    5-WHY ROOT CAUSE ANALYSIS & CAPA
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">Ticket: {selectedNc.ncNo}</h3>
                </div>
                <button
                  onClick={handleCloseCapaModal}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-600">
                <div><span className="font-semibold text-slate-700">Finding:</span> {selectedNc.checklistItem?.itemText}</div>
                <div><span className="font-semibold text-slate-700">Line:</span> {selectedNc.line?.name} &bull; <span className="font-semibold text-slate-700">Severity:</span> {selectedNc.severity}</div>
              </div>

              <form onSubmit={handleSubmitCapa} className="space-y-4">
                {/* 5-Why Chain */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    5-Why Root Cause Drilldown:
                  </label>
                  <input
                    type="text"
                    value={why1}
                    onChange={(e) => setWhy1(e.target.value)}
                    placeholder="Why 1: Why did the immediate failure occur?"
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={why2}
                    onChange={(e) => setWhy2(e.target.value)}
                    placeholder="Why 2: Why was the condition present?"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={why3}
                    onChange={(e) => setWhy3(e.target.value)}
                    placeholder="Why 3: Why was the safeguard ineffective?"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={why4}
                    onChange={(e) => setWhy4(e.target.value)}
                    placeholder="Why 4: Why was it not detected during shift startup?"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={why5}
                    onChange={(e) => setWhy5(e.target.value)}
                    placeholder="Why 5: Systemic root cause"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* Corrective Action */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Immediate Corrective Action (Containment):
                  </label>
                  <textarea
                    rows={2}
                    value={corrective}
                    onChange={(e) => setCorrective(e.target.value)}
                    placeholder="Specific containment action to fix the immediate defect..."
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* Preventive Action */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Long-Term Preventive Action (Poka-Yoke / System):
                  </label>
                  <textarea
                    rows={2}
                    value={preventive}
                    onChange={(e) => setPreventive(e.target.value)}
                    placeholder="Poka-yoke tooling, maintenance schedule change, or SOP update..."
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Target Completion Date:
                  </label>
                  <input
                    type="date"
                    value={capaTargetDate}
                    onChange={(e) => setCapaTargetDate(e.target.value)}
                    required
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseCapaModal}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCapa}
                    className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {submittingCapa ? 'Submitting...' : 'Submit CAPA for Approval'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
