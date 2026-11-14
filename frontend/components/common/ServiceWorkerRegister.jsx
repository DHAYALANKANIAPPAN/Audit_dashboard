'use client';

import { useEffect } from 'react';

/**
 * Registers the AuditPulse 360 Service Worker for offline PWA caching.
 * Supported on HTTPS and localhost.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // In development or production on localhost/https
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
          window.location.hostname === '[::1]' ||
          window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
      );

      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[AuditPulse 360 PWA] Service Worker registered with scope:', registration.scope);
        })
        .catch((err) => {
          console.warn('[AuditPulse 360 PWA] Service Worker registration failed:', err);
        });
    }
  }, []);

  return null;
}
