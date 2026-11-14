'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

/**
 * Global Toast Provider
 * Mounts in layout.js to provide accessible, auto-dismissing toast alerts
 * across all shop-floor pages via useToast().
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const success = useCallback((msg, duration) => showToast(msg, 'success', duration), [showToast]);
  const error = useCallback((msg, duration) => showToast(msg, 'error', duration), [showToast]);
  const warning = useCallback((msg, duration) => showToast(msg, 'warning', duration), [showToast]);
  const info = useCallback((msg, duration) => showToast(msg, 'info', duration), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}
      {/* Toast Render Container with aria-live accessibility */}
      <aside
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all duration-300 animate-slide-up ${
              t.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-100 border-emerald-700/80'
                : t.type === 'error'
                ? 'bg-rose-950/95 text-rose-100 border-rose-700/80'
                : t.type === 'warning'
                ? 'bg-amber-950/95 text-amber-100 border-amber-700/80'
                : 'bg-slate-900/95 text-slate-100 border-slate-700/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  t.type === 'success'
                    ? 'bg-emerald-400'
                    : t.type === 'error'
                    ? 'bg-rose-400'
                    : t.type === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-blue-400'
                }`}
              />
              <span className="leading-snug break-words">{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white text-xs font-bold p-1 rounded-md transition-colors"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

/**
 * Custom Hook to display toast notifications anywhere
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside ToastProvider
    return {
      showToast: (msg) => console.log('[Toast fallback]:', msg),
      success: (msg) => console.log('[Toast success]:', msg),
      error: (msg) => console.error('[Toast error]:', msg),
      warning: (msg) => console.warn('[Toast warning]:', msg),
      info: (msg) => console.info('[Toast info]:', msg),
      removeToast: () => {}
    };
  }
  return context;
}

/**
 * Standalone Toast component for backward compatibility
 */
export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-slide-up max-w-sm ${
        type === 'success'
          ? 'bg-emerald-950/95 text-emerald-100 border-emerald-700'
          : type === 'error'
          ? 'bg-rose-950/95 text-rose-100 border-rose-700'
          : type === 'warning'
          ? 'bg-amber-950/95 text-amber-100 border-amber-700'
          : 'bg-slate-900/95 text-slate-100 border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            type === 'success'
              ? 'bg-emerald-400'
              : type === 'error'
              ? 'bg-rose-400'
              : type === 'warning'
              ? 'bg-amber-400'
              : 'bg-blue-400'
          }`}
        />
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs font-bold px-1"
          aria-label="Close notification"
        >
          ✕
        </button>
      )}
    </div>
  );
}
