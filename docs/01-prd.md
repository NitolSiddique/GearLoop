# GearLoop — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Project | GearLoop – Sports & Outdoor Gear Rental Management System |
| Version | 1.0 |
| Status | Draft |
| Stack | React.js + TypeScript, FastAPI (Python), REST, JWT Auth, RBAC, Security Scopes |

---

## 1. Overview

GearLoop is a web application that lets a rental shop manage and rent out sports and outdoor equipment (tents, bikes, kayaks, hiking packs, cricket/football kits, etc.). Customers browse available gear and request rentals for a date range. Staff approve requests, hand out gear, and process returns. Admins manage users, inventory, categories, and view reports.

**Core functionality in brief:** Customers request to rent gear for specific dates; staff approve, issue, and receive it back; admins control inventory, users, and permissions. Access to every feature is controlled by roles and security scopes.

## 2. Problem Statement

Small gear rental shops often track inventory, bookings, and returns on paper or spreadsheets. This causes double bookings, lost items, unclear availability, missed late returns, and no accountability for who did what. GearLoop provides one secure system with clear availability, a rental lifecycle, and role-based access.

## 3. Goals and Non-Goals

### Goals
- Show real-time gear availability by date range.
- Provide a clear rental lifecycle: request → approve → issue → return.
- Prevent double booking of the same item.
- Enforce secure access using authentication, RBAC, and scopes.
- Provide a clean, responsive React + TypeScript UI.

### Non-Goals (out of scope for v1)
- Online payment gateway integration (deposit and fees are recorded, not charged online).
- Machine learning, recommendations, AI/LLM features.
- Mobile native apps, multi-branch/multi-tenant support.
- Real-time chat or push notifications (optional email/in-app notice later).

## 4. Target Users and Roles

| Role | Description |
|---|---|
| **Customer** | Registered user who browses gear and requests rentals. |
| **Staff** | Shop employee who reviews requests, issues and receives gear, logs gear condition. |
| **Admin** | Shop owner/manager with full control over users, inventory, categories, and reports. |
| Guest (unauthenticated) | Can only view the public gear catalog, register, and log in. |

## 5. User Stories

### Customer
- As a customer, I can register and log in so that I can request rentals.
- As a customer, I can browse and search gear by category, name, and availability dates.
- As a customer, I can request a rental for one or more items for a date range.
- As a customer, I can view and cancel my pending rental requests.
- As a customer, I can see my rental history, status, deposit, and any late fees.

### Staff
- As staff, I can view all rental requests and approve or reject them.
- As staff, I can mark a rental as issued when the customer picks up the gear.
- As staff, I can mark a rental as returned and record the gear condition.
- As staff, I can update a gear item's availability status (e.g. under maintenance).
- As staff, I can see overdue rentals.

### Admin
- As an admin, I can create, update, and deactivate gear items and categories.
- As an admin, I can manage users and assign roles.
- As an admin, I can configure rental rates, deposit, and late fee rules.
- As an admin, I can view reports (rentals per period, popular gear, overdue, utilization).
- As an admin, I can view an audit log of important actions.

## 6. Features

### 6.1 Must Have (MVP)
1. User registration, login, logout (JWT access + refresh tokens).
2. Role-based access control with three roles.
3. Security scopes on every protected API endpoint.
4. Gear catalog with categories, search, filter, and availability check.
5. Rental request with date range and multi-item support.
6. Rental lifecycle: Pending → Approved/Rejected → Issued → Returned (plus Cancelled and Overdue).
7. Double-booking prevention.
8. Rental cost calculation (daily rate × days), deposit, late fee on overdue return.
9. User management (admin).
10. Role-aware React dashboard for each role.

### 6.2 Should Have
- Gear condition log (on issue and return) and maintenance status.
- Admin reports with simple charts/tables.
- Audit log.

### 6.3 Could Have (future)
- Email notifications, payment gateway, gear image upload, customer reviews, QR check-in.

## 7. Permissions Summary (Role × Scope)

| Scope | Customer | Staff | Admin |
|---|:--:|:--:|:--:|
| `gear:read` | ✅ | ✅ | ✅ |
| `gear:write` | ❌ | ❌ | ✅ |
| `gear:status` | ❌ | ✅ | ✅ |
| `category:write` | ❌ | ❌ | ✅ |
| `rental:create` | ✅ | ✅ | ✅ |
| `rental:read:own` | ✅ | ✅ | ✅ |
| `rental:read:all` | ❌ | ✅ | ✅ |
| `rental:cancel:own` | ✅ | ✅ | ✅ |
| `rental:approve` | ❌ | ✅ | ✅ |
| `rental:issue` | ❌ | ✅ | ✅ |
| `rental:return` | ❌ | ✅ | ✅ |
| `user:read` | ❌ | ❌ | ✅ |
| `user:write` | ❌ | ❌ | ✅ |
| `settings:write` | ❌ | ❌ | ✅ |
| `report:read` | ❌ | ❌ | ✅ |
| `audit:read` | ❌ | ❌ | ✅ |

## 8. Key User Flows

**Rental flow**
1. Customer searches gear for dates → sees available items.
2. Customer submits a rental request → status `PENDING`.
3. Staff reviews → `APPROVED` or `REJECTED`.
4. Customer arrives; staff marks `ISSUED`.
5. Customer returns; staff marks `RETURNED` and records condition; late fee computed if overdue.

**Auth flow:** Register → Login → receive token with scopes based on role → frontend stores token and routes user to role-specific dashboard.

## 9. Success Metrics

- 100% of protected endpoints enforce authentication and scope checks.
- Zero double bookings for overlapping approved/issued rentals (verified by tests).
- A customer can complete a full rental request in under 2 minutes.
- Core API test coverage of at least 70%.
- All three roles demonstrable end-to-end in a live demo.

## 10. Assumptions and Constraints

- Single shop/location; currency and rates are configured by admin.
- Payments are recorded manually (deposit received: yes/no).
- Must be completed within the course timeline using only React + TypeScript and FastAPI.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Scope creep | Freeze MVP list in Section 6.1; defer others. |
| Availability logic bugs | Centralize date-overlap check in one service with unit tests. |
| Security mistakes | Use FastAPI `SecurityScopes`, hashed passwords, input validation. |
| Time shortage | Build backend first, then role-by-role frontend pages. |

## 12. Milestones

| Milestone | Deliverable |
|---|---|
| M1 | Project idea and name finalized (GearLoop) |
| M2 | PRD, SRS, TDD in `docs/` with Task Issue and PR link |
| M3 | Backend: auth, RBAC, scopes, gear and rental APIs |
| M4 | Frontend: auth, catalog, rental flow, dashboards |
| M5 | Testing, documentation, final demo |
