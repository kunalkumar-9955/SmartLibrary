# Smart Library Management System

A clean, modern, and production-ready **Personal Library Management System** designed for **ONE physical library** with **50 seats (`01`–`50`)**, **1 Admin**, and **Students**.

---

## Key Highlights

- **Single Library & Personal Focus**: Stripped of SaaS/multi-tenant/super-admin overhead. Simple, robust, and purpose-built for physical libraries and study spaces.
- **2 Practical User Roles**:
  - **Admin**: Complete control over students, dynamic attendance QR gate, 50-seat layout, live occupancy monitoring, complaints/tickets, notices, reports, and genuine `.xlsx` Excel export.
  - **Student**: Mobile-first portal with live `INSIDE LIBRARY` / `OUTSIDE LIBRARY` status, dynamic QR camera scanner, instant scan simulator, attendance history, tickets, notices, and profile.
- **Dynamic QR Attendance Engine**:
  - Admin displays a dynamic QR code on front desk monitor/tablet (`/admin/qr`) with 45-second countdown timer and instant regeneration.
  - One-click toggle between `[ ENTRY QR ]` and `[ EXIT QR ]`.
  - Cryptographically signed (`HMAC-SHA256`) with replay protection and short TTL (no static QR fraud or screenshot sharing).
  - Authenticated student uses their mobile phone camera to scan the Admin's QR.
- **Atomic Attendance Rules**:
  - **Rule 1**: Student cannot mark entry twice while already inside ("You are already marked inside the library.").
  - **Rule 2**: Student cannot mark exit without an active entry session ("No active attendance found.").
  - **Rule 3 & 4**: Expired or invalid QR codes are rejected at the backend level.
  - **Seat Sync**: Student automatically occupies an available seat on entry, and the seat is released back to `AVAILABLE` on exit.
- **50 Fixed Seats (`01`–`50`)**: Clean grid with three statuses: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`.
- **Genuine Excel Export (`.xlsx`)**: Exports Today's Attendance or Custom Date Range into a clean, formatted `.xlsx` workbook using `exceljs`.
- **Zero-Setup Database Architecture**: Automatically connects to MongoDB via `MONGODB_URI` or transparently spins up an embedded in-memory MongoDB instance with pre-seeded demo data if no external database is configured.

---

## Default Credentials

| Role | Email | Password | Details |
|---|---|---|---|
| **Admin** | `admin@example.com` | `Password@123` | Complete library management |
| **Student** | `student@example.com` | `Password@123` | Rahul Kumar (`ST001`, Seat 04) |

*The login page includes 1-click Quick Login buttons for both accounts.*

---

## How to Run Locally

### 1. Start Backend
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:5000`. Starts in-memory MongoDB and auto-seeds initial data.*

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

### 3. Run Automated Tests
```bash
cd backend
npm test
```

---

## Project Structure

```
/Library
├── /backend
│   ├── /src
│   │   ├── /config         # Environment & DB connection
│   │   ├── /controllers    # Auth, Attendance, QR, Seats, Students, Tickets, Notices, Reports, Settings, Excel
│   │   ├── /middleware     # JWT Auth, Role Guard, Uploads
│   │   ├── /models         # User, Seat, Attendance, Ticket, Notice, Library
│   │   ├── /routes         # Clean REST routes
│   │   ├── /seed           # Seeder (1 Admin, 10 Students, 50 Seats, Active Sessions)
│   │   ├── /utils          # HMAC-SHA256 QR engine & Excel generator
│   │   ├── /__tests__      # Integration tests (app.test.ts)
│   │   └── server.ts       # Express bootstrap
│   ├── package.json
│   └── tsconfig.json
├── /frontend
│   ├── /src
│   │   ├── /components     # StatCard, DynamicQRDisplay, StudentQRScanner, SeatGrid, Modal
│   │   ├── /contexts       # AuthContext, ToastContext
│   │   ├── /layouts        # LibraryAdminLayout, StudentLayout
│   │   ├── /pages
│   │   │   ├── /admin      # Dashboard, Students, QR, Live, Seats, History, Complaints, Notices, Reports, Settings
│   │   │   ├── /student    # Dashboard, Scanner, History, Complaints, Profile
│   │   │   └── /auth       # LoginPage
│   │   ├── /routes         # AppRoutes with ProtectedRoute guards
│   │   ├── /services       # Axios API client & endpoints
│   │   └── /types          # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts
├── /docs                   # Architecture & documentation
└── README.md
```
