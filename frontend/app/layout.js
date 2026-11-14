import ServiceWorkerRegister from '../components/common/ServiceWorkerRegister';
import localFont from "next/font/local";
import "./globals.css";
import AppLayout from "@/components/common/AppLayout";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "AuditPulse 360 - Digital Product & Revalidation Audits",
  description: "Quality 4.0 digital audit platform for automotive and manufacturing excellence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}>
        <AppLayout>
          <ServiceWorkerRegister />
        {children}
        </AppLayout>
      </body>
    </html>
  );
}
