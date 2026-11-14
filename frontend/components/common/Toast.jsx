import React from 'react';

export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const styles = {
    info: 'bg-slate-900 text-white border-slate-700',
    success: 'bg-emerald-900 text-white border-emerald-700',
    error: 'bg-rose-900 text-white border-rose-700',
    warning: 'bg-amber-900 text-white border-amber-700'
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm animate-fade-in font-medium max-w-md">
      <div className={`w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : type === 'error' ? 'bg-rose-400' : 'bg-blue-400'}`} />
      <span className="flex-1 text-slate-100">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs font-bold px-1">
          ✕
        </button>
      )}
    </div>
  );
}
