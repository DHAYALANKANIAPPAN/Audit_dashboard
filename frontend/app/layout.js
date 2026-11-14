import './globals.css';
import ServiceWorkerRegister from '../components/common/ServiceWorkerRegister';
import { ToastProvider } from '../components/common';

export const metadata = {
  title: 'AuditPulse 360 | Digital Shop-Floor Audit Management',
  description: 'Digital Product Audit and Revalidation Audit management platform with offline PWA sync',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AuditPulse 360'
  }
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased min-h-screen">
        <ServiceWorkerRegister />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
