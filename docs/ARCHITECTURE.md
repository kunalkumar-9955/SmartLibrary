# System Architecture: Smart Library Management & Student Support System

## 1. High-Level Architecture

Smart Library is an enterprise-grade, multi-tenant SaaS application built using the **MERN** stack (MongoDB, Express.js, React.js, Node.js) with TypeScript.

```
                  +----------------------------------------------+
                  |           React + Vite + TypeScript          |
                  |  Tailwind CSS - Lucide Icons - Recharts UI   |
                  +----------------------+-----------------------+
                                         |
                                         | REST APIs & JWT
                                         v
                  +----------------------------------------------+
                  |             Node.js + Express.js             |
                  |     Role-Based Auth & Multi-Tenant Guard     |
                  |    Cryptographic Dynamic QR Engine (HMAC)    |
                  +----------------------+-----------------------+
                                         |
                                         | Mongoose ODM
                                         v
                  +----------------------------------------------+
                  |              MongoDB Database                |
                  |    (Auto-fallbacks to MongoMemoryServer)     |
                  +----------------------------------------------+
```

## 2. Multi-Tenant Isolation
Every tenant (library branch) is uniquely referenced via `libraryId`:
- **Super Admin**: Has platform-wide visibility across all libraries.
- **Library Admin**: Enforced at the middleware level (`enforceTenant`). Requests with cross-tenant `libraryId` are blocked with `403 CROSS_TENANT_FORBIDDEN`.
- **Student**: Tied strictly to their registered library branch. Can only inspect their own attendance history, tickets, and notifications.

## 3. Dynamic QR Attendance Engine
- Dynamic short-lived cryptographic tokens prevent screenshot forwarding and token reuse.
- Generates `HMAC-SHA256(libraryId + qrType + token + expiresAt, QR_SECRET)`.
- Replay Cache keeps track of consumed nonces with auto-cleanup upon expiration.
- Auto-allocates vacant seats upon Entry check-in and releases them upon Exit check-out.

## 4. Ticketing & Support System
- Categories: Wi-Fi, Slow Internet, AC, Electricity, Cleanliness, Noise, Charging Point, Seat Damage, Washroom, Other.
- Priorities: LOW, MEDIUM, HIGH, URGENT.
- In-app notification triggers when administrators update ticket statuses or post comments.
