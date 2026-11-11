# AuditPulse 360 🔍⚡

> **Quality 4.0 Digital Product Audit & Revalidation Platform**  
> Problem Statement: PS-015 (Theme: Digitalization & Workflow Automation)

AuditPulse 360 transforms manufacturing product and revalidation audits from paper checklists and fragmented spreadsheets into an end-to-end, real-time digital system running on desktop, tablet, and mobile browsers.

---

## 👥 Team & Responsibilities
- **Dhaya (Lead):** DevOps, Database schema, Authentication (RBAC), Planning upload, Shift Roster Engine.
- **Bhava:** Shop-floor PWA inspection app, offline caching, photo capture, auto-sync.
- **Linga:** Automatic NC routing, CAPA submission, MinIO evidence storage, two-tier approvals, background reminders/escalations.
- **Akshiya:** Analytics dashboard, KPI calculation engine, audit history search, PDF/Excel compliance exports, demo data.

---

## 🛠️ Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + PWA (Service Worker + IndexedDB)
- **Backend:** Node.js + Express REST API
- **Database & ORM:** PostgreSQL 16 + Prisma ORM
- **Cache & Jobs:** Redis + BullMQ
- **File Storage:** MinIO (S3-compatible) with fallback to local `/uploads`
- **Environment:** Docker Compose

---

## 📂 Repository Layout
```
auditpulse-360/
  backend/
    src/
      server.js
      middleware/auth.js
      modules/{auth,plans,roster,inspections,nc,capa,approvals,evidence,notifications,analytics,history,reports}/
      jobs/{reminders.js,escalation.js}
    prisma/
      schema.prisma
      seed.js
      seed-demo.js
  frontend/
    app/{login,planning,calendar,inspect,ncs,approvals,dashboard,history}/
    components/common/
    lib/api.js
    public/{manifest.json,sw.js}
  docs/{api.md,mock/,nc-workflow.md,impact.md}
  docker-compose.yml
  .env.example
  README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### 2. Start Infrastructure Services
```bash
docker compose up -d
```
Starts PostgreSQL (`5432`), Redis (`6379`), and MinIO (`9000`, console on `9001`).

### 3. Backend Setup
```bash
cd backend
cp ../.env.example .env
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```
Backend runs on `http://localhost:5000`. Health check: `http://localhost:5000/api/health`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`.

---

## 🌿 Git Branching Rules
- `main`: Protected, production-ready branch. Nobody pushes directly.
- `develop`: Shared integration branch. All features merge here via Pull Request.
- `feature/<name>-<task>`: Working branch created strictly from `develop`.

---

## 🔑 Roles & Demo Credentials
- **AUDITOR:** `auditor@auditpulse.local` / `demo123`
- **AUDITEE:** `auditee@auditpulse.local` / `demo123`
- **AUDIT_HEAD:** `audithead@auditpulse.local` / `demo123`
- **PLANT_MANAGER:** `plantmanager@auditpulse.local` / `demo123`
- **ADMIN:** `admin@auditpulse.local` / `demo123`
