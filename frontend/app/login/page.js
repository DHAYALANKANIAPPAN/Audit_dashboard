'use client';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 text-white">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700">
        <h1 className="text-2xl font-bold text-center text-blue-400">AuditPulse 360</h1>
        <p className="text-slate-400 text-center text-sm mt-1">Sign in to your account</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Email</label>
            <input type="email" placeholder="auditor@auditpulse.local" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Password</label>
            <input type="password" placeholder="••••••••" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-semibold rounded transition text-sm">
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
