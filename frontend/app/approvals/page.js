'use client';

import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/common/AppLayout';
import { getPendingApprovals, decideApproval } from '@/lib/api';

export default function ApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [tier1Items, setTier1Items] = useState([]);
  const [tier2Items, setTier2Items] = useState([]);
  const [activeTab, setActiveTab] = useState('TIER_1'); // 'TIER_1' or 'TIER_2'
  const [processingId, setProcessingId] = useState(null);

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPendingApprovals();
      if (res) {
        setTier1Items(res.tier1 || []);
        setTier2Items(res.tier2 || []);
      }
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleDecision = async (ncId, stage, decision) => {
    const defaultRemark = decision === 'ACCEPT'
      ? (stage === 'AUDITOR_VERIFY' ? 'On-site verification completed. Action plan accepted.' : 'Final quality compliance sign-off approved.')
      : 'Corrective action plan insufficient. Please revise.';

    const remark = prompt(`Enter signature remark for ${decision === 'ACCEPT' ? 'APPROVAL' : 'REJECTION'}:`, defaultRemark);
    if (remark === null) return; // cancelled

    setProcessingId(ncId);
    try {
      await decideApproval(ncId, {
        stage,
        decision,
        remark,
      });
      alert(`Decision recorded: ${decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'}`);
      loadApprovals();
    } catch (err) {
      alert(`Failed to submit approval: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const currentList = activeTab === 'TIER_1' ? tier1Items : tier2Items;

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Two-Tier Sign-off Approvals</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full border border-indigo-300">
                Digital Sign-Off Cockpit
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Tier 1 Auditor on-site verification &bull; Tier 2 Quality Head final compliance sign-off and closure
            </p>
          </div>

          <button
            onClick={loadApprovals}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition self-start sm:self-auto"
          >
            <svg className="w-4 h-4 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Tier Selection Tabs */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab('TIER_1')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'TIER_1'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Tier 1: Auditor Verification</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'TIER_1' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tier1Items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('TIER_2')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeTab === 'TIER_2'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Tier 2: Plant Quality Head Sign-Off</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'TIER_2' ? 'bg-purple-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tier2Items.length}
            </span>
          </button>
        </div>

        {/* Content List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-xs">Loading pending sign-offs...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200 p-6">
            <svg className="w-12 h-12 mx-auto mb-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-slate-700">Inbox Zero!</p>
            <p className="text-xs text-slate-400 mt-1">
              No pending {activeTab === 'TIER_1' ? 'Auditor verification' : 'Plant Quality Head sign-off'} approvals at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {currentList.map((nc) => (
              <div
                key={nc.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
                      {nc.ncNo}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        nc.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : nc.severity === 'MAJOR'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {nc.severity}
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      Line: {nc.line?.name}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    Target SLA: <span className="font-semibold text-slate-700">{new Date(nc.targetDate).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                {/* Finding & CAPA Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Inspection Defect Finding:
                    </span>
                    <p className="text-slate-800 font-medium">{nc.checklistItem?.itemText || nc.remark}</p>
                    <div className="text-slate-500 pt-1 text-[11px]">
                      Auditee Owner: <span className="font-medium text-slate-700">{nc.auditee?.name || 'Line Supervisor'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 bg-purple-50/50 p-3.5 rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 uppercase tracking-wider text-[10px]">
                        Submitted 5-Why CAPA Plan:
                      </span>
                      <span className="text-[10px] font-mono text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                        {nc.capa?.rootCauseMethod || '5-WHY'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Root Cause:</span>
                      <p className="text-slate-600 italic mt-0.5">{nc.capa?.rootCause}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Corrective:</span>
                      <p className="text-slate-600 mt-0.5">{nc.capa?.corrective}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Preventive:</span>
                      <p className="text-slate-600 mt-0.5">{nc.capa?.preventive}</p>
                    </div>
                  </div>
                </div>

                {/* Approvals Prior History (for Tier 2) */}
                {activeTab === 'TIER_2' && nc.approvals && nc.approvals.length > 0 && (
                  <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-xs flex items-center space-x-2 text-blue-900">
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      <strong>Tier 1 Verified By:</strong> {nc.approvals[0]?.byUser?.name} &bull; &ldquo;{nc.approvals[0]?.remark}&rdquo;
                    </span>
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    disabled={processingId === nc.id}
                    onClick={() => handleDecision(nc.id, activeTab === 'TIER_1' ? 'AUDITOR_VERIFY' : 'HEAD_SIGNOFF', 'REJECT')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition disabled:opacity-50"
                  >
                    Reject (Request Rework)
                  </button>

                  <button
                    disabled={processingId === nc.id}
                    onClick={() => handleDecision(nc.id, activeTab === 'TIER_1' ? 'AUDITOR_VERIFY' : 'HEAD_SIGNOFF', 'ACCEPT')}
                    className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm transition disabled:opacity-50 ${
                      activeTab === 'TIER_1'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {processingId === nc.id
                      ? 'Signing...'
                      : activeTab === 'TIER_1'
                      ? '✓ Approve & Verify CAPA'
                      : '✓ Final Sign-Off & Close Ticket'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
