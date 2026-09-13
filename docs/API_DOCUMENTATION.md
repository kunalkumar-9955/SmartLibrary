# API Documentation

## Base URL
`/api`

## Authentication
All protected routes require an `Authorization: Bearer <jwt_token>` header.

### Endpoints Overview

| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `POST` | `/api/auth/login` | Log in and receive JWT token | Public |
| `GET` | `/api/auth/me` | Retrieve active authenticated profile | Any authenticated |
| `POST` | `/api/auth/logout` | Register logout audit record | Any authenticated |
| `GET` | `/api/super-admin/dashboard` | Platform metrics & active branches | `SUPER_ADMIN` |
| `GET` | `/api/super-admin/libraries` | List all registered libraries | `SUPER_ADMIN` |
| `POST` | `/api/super-admin/libraries` | Provision new library branch | `SUPER_ADMIN` |
| `PUT` | `/api/super-admin/libraries/:id`| Update library profile | `SUPER_ADMIN` |
| `GET` | `/api/super-admin/admins` | List library administrators | `SUPER_ADMIN` |
| `GET` | `/api/library-admin/dashboard` | Branch dashboard metrics & urgent issues | `LIBRARY_ADMIN` |
| `GET` | `/api/library-admin/occupancy` | Currently seated students with live timers | `LIBRARY_ADMIN` |
| `GET` | `/api/students` | List branch students (search, filter) | `LIBRARY_ADMIN` |
| `POST` | `/api/students` | Enroll student & create membership pass | `LIBRARY_ADMIN` |
| `PATCH`| `/api/students/:id/status` | Update account status (ACTIVE/BLOCKED) | `LIBRARY_ADMIN` |
| `POST` | `/api/qr/generate` | Generate dynamic 60-second QR token | `LIBRARY_ADMIN` |
| `POST` | `/api/attendance/entry` | Mark entry attendance & occupy seat | `STUDENT` |
| `POST` | `/api/attendance/exit` | Mark exit, calculate duration, free seat | `STUDENT` |
| `GET` | `/api/attendance/my` | Retrieve student attendance history | `STUDENT` |
| `GET` | `/api/attendance` | Full branch attendance audit log | `LIBRARY_ADMIN` |
| `POST` | `/api/attendance/force-checkout/:id` | Force checkout absent student | `LIBRARY_ADMIN` |
| `GET` | `/api/seats` | List seats with status tags | Any authenticated |
| `GET` | `/api/seats/layout` | Grouped floor & section layout | Any authenticated |
| `POST` | `/api/seats/batch` | Batch generate seats by floor/prefix | `LIBRARY_ADMIN` |
| `PATCH`| `/api/seats/:id/status` | Update seat status (MAINTENANCE/BLOCKED)| `LIBRARY_ADMIN` |
| `POST` | `/api/tickets` | Raise support ticket with optional image | `STUDENT` |
| `GET` | `/api/tickets` | List tickets (filters by status/priority)| Any authenticated |
| `PATCH`| `/api/tickets/:id/status`| Update ticket status & resolution note | `LIBRARY_ADMIN` |
| `POST` | `/api/tickets/:id/comments` | Post comment in discussion thread | Any authenticated |
| `GET` | `/api/notices` | List announcements & alerts | Any authenticated |
| `POST` | `/api/notices` | Publish branch notice | `LIBRARY_ADMIN` |
| `GET` | `/api/reports/attendance` | Daily attendance trends & peak hours | `LIBRARY_ADMIN` |
| `GET` | `/api/reports/tickets` | Complaints breakdown by category | `LIBRARY_ADMIN` |
| `GET` | `/api/reports/export/attendance` | Download CSV attendance report | `LIBRARY_ADMIN` |
