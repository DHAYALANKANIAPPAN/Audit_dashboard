'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function PlanningPage() {
  const [month, setMonth] = useState('2026-11');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  // Load audit plans for the selected month
  const loadPlans = async (targetMonth = month) => {
    setLoading(true);
    try {
      const data = await fetchApi(`/plans?month=${targetMonth}`);
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load audit plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans(month);
  }, [month]);

  // Handle Download Template
  const handleDownloadTemplate = () => {
    window.open(`${API_BASE_URL}/plans/template`, '_blank');
  };

  // Handle File Selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  // Handle Upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_BASE_URL}/plans/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadResult(result);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // Refresh the plan list to show newly inserted records
      loadPlans(month);
    } catch (err) {
      setUploadResult({
        inserted: 0,
        errors: [{ row: '-', message: err.message }],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>📅</span> Monthly Audit Planning
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload CSV/Excel monthly audit schedules, validate shift plans, and dispatch to roster engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition shadow-sm"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV Template
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <span>📤</span> Plan Upload Box
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Accepts <code>.csv</code> or <code>.xlsx</code> with columns: <em>month, auditType, line, department, product, plannedDate, shift</em>.
            </p>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-xl p-6 text-center cursor-pointer transition bg-slate-900/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="plan-file-upload"
                />
                <label htmlFor="plan-file-upload" className="cursor-pointer block">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-slate-300 block">
                    {selectedFile ? selectedFile.name : 'Choose CSV or Excel file'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Click to browse from computer'}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium rounded-lg text-xs transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Validating & Uploading...</span>
                  </>
                ) : (
                  <span>Upload & Save Valid Plans</span>
                )}
              </button>
            </form>
          </div>

          {/* Validation Feedback */}
          {uploadResult && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              {uploadResult.inserted > 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Successfully inserted <strong>{uploadResult.inserted}</strong> plan(s)!</span>
                </div>
              )}

              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span><strong>{uploadResult.errors.length}</strong> row(s) failed validation.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Validation Errors Table (Conditional) */}
        <div className="lg:col-span-2 bg-slate-950 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Validation Diagnostics</h2>
              <p className="text-xs text-slate-400">Rows failing validation are reported here with row numbers and errors</p>
            </div>
            {uploadResult?.errors?.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {uploadResult.errors.length} Errors Found
              </span>
            )}
          </div>

          {uploadResult?.errors && uploadResult.errors.length > 0 ? (
            <div className="overflow-x-auto max-h-60 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 w-20">Row</th>
                    <th className="py-2.5 px-4">Error Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {uploadResult.errors.map((err, idx) => (
                    <tr key={idx} className="hover:bg-rose-500/5">
                      <td className="py-2.5 px-4 text-rose-400 font-bold">{err.row}</td>
                      <td className="py-2.5 px-4 text-slate-300">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-44 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs">No validation errors to report.</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Upload a file to test row integrity.</p>
            </div>
          )}
        </div>
      </div>

      {/* Plan Registry & Preview Table */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📋</span> Planned Audits Registry
            </h2>
            <p className="text-xs text-slate-400">All planned audits for the selected month in PostgreSQL</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 font-medium">Month:</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => loadPlans(month)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Planned Date</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Line</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Auditee (Owner)</th>
                <th className="py-3 px-4">Roster Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <div className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p>Loading audit plans...</p>
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No audit plans found for {month}. Use the upload box above to import plans.
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const dateStr = p.plannedDate ? new Date(p.plannedDate).toLocaleDateString() : '-';
                  const isScheduled = p.schedules && p.schedules.length > 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-white">{dateStr}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          Shift {p.shift}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.auditType === 'PRODUCT'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        }`}>
                          {p.auditType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">{p.line?.name || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{p.product}</td>
                      <td className="py-3 px-4 text-slate-400">{p.department?.name || '-'}</td>
                      <td className="py-3 px-4 text-slate-400">{p.line?.owner?.name || '-'}</td>
                      <td className="py-3 px-4">
                        {isScheduled ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Scheduled ({p.schedules[0].auditor?.name?.split(' ')[0] || 'Assigned'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Pending Roster
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
