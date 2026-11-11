'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

const QUICK_ROLES = [
  { label: 'Auditor', email: 'auditor@auditpulse.local', role: 'AUDITOR', path: '/inspect' },
  { label: 'Auditee (Line 1)', email: 'auditee@auditpulse.local', role: 'AUDITEE', path: '/ncs' },
  { label: 'Audit Head', email: 'audithead@auditpulse.local', role: 'AUDIT_HEAD', path: '/approvals' },
  { label: 'Plant Manager', email: 'plantmanager@auditpulse.local', role: 'PLANT_MANAGER', path: '/dashboard' },
  { label: 'Admin', email: 'admin@auditpulse.local', role: 'ADMIN', path: '/planning' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e, customEmail = null, customPass = null, defaultPath = '/dashboard') => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const targetEmail = customEmail || email;
    const targetPass = customPass || password;

    try {
      const data = await login(targetEmail, targetPass);
      // Determine redirection based on role
      let redirectPath = defaultPath;
      if (data.user.role === 'AUDITOR') redirectPath = '/inspect';
      else if (data.user.role === 'AUDITEE') redirectPath = '/ncs';
      else if (data.user.role === 'AUDIT_HEAD') redirectPath = '/approvals';
      else if (data.user.role === 'PLANT_MANAGER') redirectPath = '/dashboard';
      else if (data.user.role === 'ADMIN') redirectPath = '/planning';

      router.push(redirectPath);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const selectQuickRole = (r) => {
    setEmail(r.email);
    setPassword('demo123');
    handleLogin(null, r.email, 'demo123', r.path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <div className="max-w-md w-full bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 mb-3 border border-blue-500/30">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AuditPulse 360</h1>
          <p className="text-slate-400 text-sm mt-1">Digital Product Audit & Revalidation Management</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="auditor@auditpulse.local"
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wider text-center">
            ⚡ Quick Demo Logins (password: demo123)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ROLES.map((r) => (
              <button
                key={r.email}
                type="button"
                onClick={() => selectQuickRole(r)}
                className="px-2.5 py-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition text-left flex items-center justify-between group"
              >
                <span className="font-medium truncate">{r.label}</span>
                <span className="text-[10px] text-blue-400 opacity-60 group-hover:opacity-100 font-mono">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
