# GearLoop — Software Requirements Specification (SRS)

| Field | Value |
|---|---|
| Project | GearLoop – Sports & Outdoor Gear Rental Management System |
| Version | 1.0 |
| Status | Draft |

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements of GearLoop, a web application for managing sports and outdoor gear rentals.

### 1.2 Scope
GearLoop provides a React + TypeScript frontend and a FastAPI backend exposing REST APIs. It supports authentication, role-based access control (RBAC), security scopes, gear inventory management, and the complete rental lifecycle.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| RBAC | Role-Based Access Control |
| Scope | A fine-grained permission string (e.g. `rental:approve`) embedded in the access token |
| Rental | A booking of one or more gear items for a date range |
| Gear Item | A physical rentable unit (e.g. "Tent X, unit #3") |
| JWT | JSON Web Token |

### 1.4 References
- PRD (`docs/PRD.md`), TDD (`docs/TDD.md`)
- FastAPI Security with Scopes documentation

## 2. Overall Description

### 2.1 Product Perspective
A standalone three-tier web app: React SPA → FastAPI REST API → relational database.

### 2.2 User Classes
Guest, Customer, Staff, Admin (see PRD Section 4).

### 2.3 Operating Environment
- Frontend: modern browsers (Chrome, Firefox, Edge, Safari), React 18 + TypeScript.
- Backend: Python 3.11+, FastAPI, Uvicorn.
- Database: PostgreSQL (SQLite allowed for local development).

### 2.4 Assumptions and Dependencies
- Users have internet access and a modern browser.
- Payments are recorded manually; no external payment provider.

## 3. Functional Requirements

### 3.1 Authentication and Account (FR-AUTH)
- **FR-AUTH-1** The system shall allow a guest to register with name, email, phone, and password.
- **FR-AUTH-2** Email shall be unique; passwords shall be at least 8 characters.
- **FR-AUTH-3** The system shall authenticate users with email and password and return a JWT access token and a refresh token.
- **FR-AUTH-4** The access token shall contain the user's id, role, and granted scopes.
- **FR-AUTH-5** The system shall allow token refresh and logout (refresh token invalidation).
- **FR-AUTH-6** The system shall allow a logged-in user to view and update their own profile and change their password.
- **FR-AUTH-7** New registrations shall receive the `CUSTOMER` role by default.

### 3.2 Authorization: RBAC and Scopes (FR-AUTHZ)
- **FR-AUTHZ-1** The system shall support roles: `CUSTOMER`, `STAFF`, `ADMIN`.
- **FR-AUTHZ-2** Each role shall map to a fixed set of scopes (see PRD Section 7).
- **FR-AUTHZ-3** Every protected endpoint shall declare required scopes and reject requests lacking them with HTTP 403.
- **FR-AUTHZ-4** Requests without a valid token shall be rejected with HTTP 401.
- **FR-AUTHZ-5** Customers shall only access their own rentals (ownership check in addition to scope check).
- **FR-AUTHZ-6** Frontend routes and UI elements shall be shown or hidden based on role/scopes (backend remains the source of truth).
- **FR-AUTHZ-7** Admins shall be able to change a user's role and activate/deactivate accounts.

### 3.3 Gear and Category Management (FR-GEAR)
- **FR-GEAR-1** Admins shall create, update, and deactivate categories (name, description).
- **FR-GEAR-2** Admins shall create, update, and deactivate gear items with: name, category, description, size/model, daily rate, deposit amount, condition, status.
- **FR-GEAR-3** Gear status values: `AVAILABLE`, `MAINTENANCE`, `RETIRED`.
- **FR-GEAR-4** Staff and admins shall update a gear item's status (e.g. send to maintenance).
- **FR-GEAR-5** All users, including guests, shall list and search gear with filters: category, keyword, price range, and availability for a date range.
- **FR-GEAR-6** Results shall be paginated and sortable.

### 3.4 Rental Management (FR-RENT)
- **FR-RENT-1** A customer shall create a rental request with one or more gear items, a start date, and an end date.
- **FR-RENT-2** The system shall validate: start date is today or later, end date is not before start date, items exist and are `AVAILABLE`.
- **FR-RENT-3** The system shall reject a request if any item overlaps with another rental in `APPROVED` or `ISSUED` status for the same dates.
- **FR-RENT-4** The system shall calculate the total cost as the sum of (daily rate × number of days) and the total deposit.
- **FR-RENT-5** New rentals shall have status `PENDING`.
- **FR-RENT-6** Customers shall cancel their own rental while it is `PENDING` or `APPROVED`.
- **FR-RENT-7** Staff/admin shall approve or reject a `PENDING` rental; rejection requires a reason.
- **FR-RENT-8** Staff/admin shall mark an `APPROVED` rental as `ISSUED` and record the issue condition notes and whether the deposit was received.
- **FR-RENT-9** Staff/admin shall mark an `ISSUED` rental as `RETURNED`, recording the return date and condition notes.
- **FR-RENT-10** If returned after the end date, the system shall compute a late fee (admin-configured daily late fee × late days).
- **FR-RENT-11** The system shall flag `ISSUED` rentals past their end date as overdue (computed on read or by a scheduled job).
- **FR-RENT-12** Status transitions shall follow the allowed state machine only (see Section 6); invalid transitions return HTTP 409/422.
- **FR-RENT-13** Customers shall list their rentals; staff/admin shall list all rentals with filters (status, date range, customer).

### 3.5 User Management (FR-USER)
- **FR-USER-1** Admins shall list, search, view, create, update, and deactivate users.
- **FR-USER-2** Admins shall not be able to deactivate or demote themselves.

### 3.6 Settings (FR-SET)
- **FR-SET-1** Admins shall configure the late fee per day and the maximum rental length in days.

### 3.7 Reports and Audit (FR-REP)
- **FR-REP-1** Admins shall view: total rentals by period, most rented gear, current overdue rentals, and gear utilization.
- **FR-REP-2** The system shall log key actions (login, role change, approve/reject, issue, return, gear changes) with actor, action, entity, and timestamp.
- **FR-REP-3** Admins shall view the audit log with pagination and filters.

## 4. External Interface Requirements

### 4.1 User Interface
- Responsive React SPA with role-specific navigation and dashboards.
- Pages: Login, Register, Gear Catalog, Gear Detail, My Rentals, New Rental, Staff Rental Queue, Admin Gear/Category/User management, Reports, Audit Log, Settings, Profile.
- Clear validation messages and loading/error states.

### 4.2 API Interface
- RESTful JSON API under `/api/v1`.
- OAuth2 password flow with Bearer JWT; OpenAPI docs at `/docs`.
- Standard HTTP status codes and a consistent error body: `{ "detail": "message" }`.

### 4.3 Database Interface
- Relational database accessed through SQLAlchemy ORM with Alembic migrations.

## 5. Non-Functional Requirements

### 5.1 Security (NFR-SEC)
- **NFR-SEC-1** Passwords shall be hashed with bcrypt (or argon2); never stored or logged in plain text.
- **NFR-SEC-2** Access tokens shall expire in 15–30 minutes; refresh tokens in 7 days.
- **NFR-SEC-3** All input shall be validated server-side with Pydantic schemas.
- **NFR-SEC-4** CORS shall allow only the configured frontend origin.
- **NFR-SEC-5** SQL injection shall be prevented by using the ORM / parameterized queries.
- **NFR-SEC-6** Secrets (JWT key, DB URL) shall be stored in environment variables, not in source control.
- **NFR-SEC-7** Login endpoint should be rate limited to reduce brute-force attempts.
- **NFR-SEC-8** HTTPS shall be used in deployment.

### 5.2 Performance (NFR-PERF)
- Typical API responses under 500 ms for list/search with up to 10,000 gear records.
- Paginated list endpoints (default 20, max 100 per page).

### 5.3 Reliability and Data Integrity (NFR-REL)
- Rental creation and status changes shall run in database transactions.
- Soft delete (deactivate) for users and gear that have rental history.

### 5.4 Usability (NFR-USE)
- A first-time customer should complete a rental request without instruction.
- Responsive layout for desktop and mobile widths.

### 5.5 Maintainability (NFR-MAINT)
- Layered backend (routers, services, repositories/models, schemas).
- Typed frontend (TypeScript strict mode); API client generated or centrally typed.
- Linting and formatting enforced (ruff/black, ESLint/Prettier).

### 5.6 Testing (NFR-TEST)
- Backend unit and API tests with pytest, at least 70% coverage of core logic.
- Frontend component tests for key flows (optional but encouraged).

### 5.7 Portability
- Run locally with Docker Compose (frontend, backend, database).

## 6. Rental Status State Machine

| From | To | Actor |
|---|---|---|
| (new) | `PENDING` | Customer |
| `PENDING` | `APPROVED` / `REJECTED` | Staff, Admin |
| `PENDING` / `APPROVED` | `CANCELLED` | Customer (own), Staff, Admin |
| `APPROVED` | `ISSUED` | Staff, Admin |
| `ISSUED` | `RETURNED` | Staff, Admin |

`OVERDUE` is a derived flag on `ISSUED` rentals where today > end date.

## 7. Business Rules

- BR-1: A gear item cannot be in two overlapping `APPROVED`/`ISSUED` rentals.
- BR-2: Rental days = (end date − start date) + 1.
- BR-3: Late fee = late days × configured late fee per day.
- BR-4: Items in `MAINTENANCE` or `RETIRED` cannot be newly requested.
- BR-5: Gear and users with rental history cannot be hard deleted.
- BR-6: Maximum rental duration is set by admin (default 14 days).

## 8. Data Requirements (summary)

Entities: User, Category, GearItem, Rental, RentalItem, AuditLog, Setting, RefreshToken. Detailed schema is in the TDD.

## 9. Acceptance Criteria (samples)

- Given a customer token, when calling `POST /api/v1/gear`, then the response is 403.
- Given an item already approved for 10–12 Nov, when another customer requests it for 11–13 Nov, then the response is 409.
- Given an issued rental with end date in the past, when staff marks it returned, then a late fee is calculated and stored.
- Given no token, when calling `GET /api/v1/rentals/me`, then the response is 401.
- Given a customer, when requesting another customer's rental by id, then the response is 403 (or 404).
