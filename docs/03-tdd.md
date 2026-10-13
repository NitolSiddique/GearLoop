# GearLoop — Technical Design Document (TDD)

| Field | Value |
|---|---|
| Project | GearLoop – Sports & Outdoor Gear Rental Management System |
| Version | 1.0 |
| Status | Draft |

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite, React Router, TanStack Query, Axios, React Hook Form + Zod, Tailwind CSS (or MUI) |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 |
| ORM / Migrations | SQLAlchemy 2.x, Alembic |
| Database | PostgreSQL (SQLite for quick local dev) |
| Auth | OAuth2 password flow, JWT (python-jose or PyJWT), bcrypt via passlib |
| Testing | pytest, httpx/TestClient, Vitest + React Testing Library |
| DevOps | Docker, Docker Compose, GitHub Actions (lint + tests) |

## 2. System Architecture

```
┌──────────────┐   HTTPS / JSON    ┌───────────────────────────┐    SQL    ┌────────────┐
│ React + TS   │ ────────────────► │ FastAPI                   │ ────────► │ PostgreSQL │
│ SPA (Vite)   │ ◄──────────────── │ Routers → Services → Repo │ ◄──────── │            │
└──────────────┘   Bearer JWT      └───────────────────────────┘           └────────────┘
```

Backend layers:
- **Routers (API layer):** HTTP, validation, dependency injection, scope checks.
- **Services:** business rules (availability, pricing, state machine).
- **Repositories / Models:** database access via SQLAlchemy.
- **Schemas:** Pydantic request/response models.
- **Core:** config, security, dependencies, error handlers.

## 3. Project Structure

```
gearloop/
├── docs/                 # PRD.md, SRS.md, TDD.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/         # config.py, security.py, scopes.py, deps.py
│   │   ├── models/       # user.py, gear.py, rental.py, audit.py, ...
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── routers/      # auth.py, users.py, gear.py, categories.py, rentals.py, reports.py, settings.py
│   │   ├── services/     # auth_service.py, rental_service.py, availability.py, report_service.py
│   │   └── db/           # session.py, base.py, seed.py
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/          # axios client + typed endpoints
│   │   ├── auth/         # AuthContext, ProtectedRoute, useAuth
│   │   ├── components/
│   │   ├── pages/        # customer/, staff/, admin/, public/
│   │   ├── routes/
│   │   ├── types/
│   │   └── main.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 4. Database Design

### 4.1 Entities

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID/int PK | |
| full_name | varchar(100) | |
| email | varchar(150) | unique, indexed |
| phone | varchar(20) | |
| password_hash | varchar | |
| role | enum(CUSTOMER, STAFF, ADMIN) | default CUSTOMER |
| is_active | bool | default true |
| created_at / updated_at | timestamp | |

**refresh_tokens**: id, user_id (FK), token_hash, expires_at, revoked (bool), created_at.

**categories**: id, name (unique), description, is_active.

**gear_items**
| Column | Type | Notes |
|---|---|---|
| id | PK | |
| category_id | FK → categories | |
| name | varchar(150) | indexed |
| description | text | |
| size_or_model | varchar(50) | |
| daily_rate | numeric(10,2) | |
| deposit_amount | numeric(10,2) | |
| condition | enum(NEW, GOOD, FAIR, POOR) | |
| status | enum(AVAILABLE, MAINTENANCE, RETIRED) | |
| is_active | bool | |
| created_at / updated_at | timestamp | |

**rentals**
| Column | Type | Notes |
|---|---|---|
| id | PK | |
| customer_id | FK → users | |
| start_date / end_date | date | |
| status | enum(PENDING, APPROVED, REJECTED, ISSUED, RETURNED, CANCELLED) | |
| total_cost | numeric(10,2) | |
| total_deposit | numeric(10,2) | |
| deposit_received | bool | |
| late_fee | numeric(10,2) | default 0 |
| rejection_reason | text | nullable |
| issue_notes / return_notes | text | nullable |
| approved_by / issued_by / returned_by | FK → users | nullable |
| issued_at / returned_at | timestamp | nullable |
| created_at / updated_at | timestamp | |

**rental_items**: id, rental_id (FK), gear_item_id (FK), daily_rate_snapshot, deposit_snapshot. Unique (rental_id, gear_item_id).

**settings**: key (PK), value. Examples: `late_fee_per_day`, `max_rental_days`.

**audit_logs**: id, actor_id (FK), action, entity_type, entity_id, details (JSON), created_at.

### 4.2 Relationships

- users 1—N rentals
- categories 1—N gear_items
- rentals 1—N rental_items N—1 gear_items

### 4.3 Indexes

- `users(email)` unique
- `gear_items(category_id, status)`
- `rental_items(gear_item_id)` and `rentals(status, start_date, end_date)` for availability queries

## 5. Authentication and Authorization Design

### 5.1 Flow
1. `POST /api/v1/auth/login` with email and password (OAuth2 form).
2. Server verifies the bcrypt hash, loads the user's role, and maps it to scopes.
3. Server issues a JWT access token containing `sub`, `role`, `scopes`, `exp`, plus a refresh token.
4. Frontend sends `Authorization: Bearer <token>` on each request.
5. Protected endpoints use `Security(get_current_user, scopes=[...])`, which decodes the token and checks that all required scopes are present.

### 5.2 Role → Scope Mapping (`core/scopes.py`)

```python
CUSTOMER_SCOPES = [
    "gear:read", "rental:create", "rental:read:own", "rental:cancel:own",
]
STAFF_SCOPES = CUSTOMER_SCOPES + [
    "gear:status", "rental:read:all", "rental:approve", "rental:issue", "rental:return",
]
ADMIN_SCOPES = STAFF_SCOPES + [
    "gear:write", "category:write", "user:read", "user:write",
    "settings:write", "report:read", "audit:read",
]
ROLE_SCOPES = {"CUSTOMER": CUSTOMER_SCOPES, "STAFF": STAFF_SCOPES, "ADMIN": ADMIN_SCOPES}
```

### 5.3 Core Dependency Sketch

```python
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    scopes={s: s for s in ADMIN_SCOPES},
)

async def get_current_user(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_jwt(token)                      # raises 401 if invalid/expired
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(401, "Invalid user")
    token_scopes = payload.get("scopes", [])
    for scope in security_scopes.scopes:
        if scope not in token_scopes:
            raise HTTPException(403, "Not enough permissions")
    return user
```

### 5.4 Ownership Checks
For `rental:read:own` endpoints, the service verifies `rental.customer_id == current_user.id`. Staff/admin holding `rental:read:all` bypass this check.

### 5.5 Security Measures
- bcrypt password hashing; minimum length validation.
- Short-lived access tokens; refresh tokens stored hashed and revocable.
- CORS restricted to frontend origin.
- Rate limiting on `/auth/login` (e.g. slowapi).
- Pydantic validation on all input; ORM prevents SQL injection.
- Secrets from environment variables (`.env`, not committed).
- Frontend: token held in memory (with refresh); route guards plus UI hiding based on scopes.

## 6. REST API Design

Base path: `/api/v1`. All responses are JSON.

### 6.1 Auth

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Register customer |
| POST | `/auth/login` | public | Login, get tokens |
| POST | `/auth/refresh` | public (refresh token) | New access token |
| POST | `/auth/logout` | authenticated | Revoke refresh token |
| GET | `/auth/me` | authenticated | Current user profile |
| PUT | `/auth/me` | authenticated | Update profile |
| POST | `/auth/change-password` | authenticated | Change password |

### 6.2 Users (Admin)

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| GET | `/users` | `user:read` | List/search users |
| GET | `/users/{id}` | `user:read` | User detail |
| POST | `/users` | `user:write` | Create user (any role) |
| PUT | `/users/{id}` | `user:write` | Update user |
| PATCH | `/users/{id}/role` | `user:write` | Change role |
| PATCH | `/users/{id}/status` | `user:write` | Activate/deactivate |

### 6.3 Categories

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| GET | `/categories` | public | List categories |
| POST | `/categories` | `category:write` | Create |
| PUT | `/categories/{id}` | `category:write` | Update |
| DELETE | `/categories/{id}` | `category:write` | Deactivate |

### 6.4 Gear

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| GET | `/gear` | public / `gear:read` | List with filters: `q`, `category_id`, `min_price`, `max_price`, `available_from`, `available_to`, `page`, `size` |
| GET | `/gear/{id}` | public / `gear:read` | Detail |
| GET | `/gear/{id}/availability` | `gear:read` | Booked date ranges |
| POST | `/gear` | `gear:write` | Create |
| PUT | `/gear/{id}` | `gear:write` | Update |
| PATCH | `/gear/{id}/status` | `gear:status` | Set AVAILABLE/MAINTENANCE/RETIRED |
| DELETE | `/gear/{id}` | `gear:write` | Deactivate |

### 6.5 Rentals

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| POST | `/rentals` | `rental:create` | Create rental request |
| GET | `/rentals/me` | `rental:read:own` | My rentals |
| GET | `/rentals` | `rental:read:all` | All rentals (filters: status, date range, customer) |
| GET | `/rentals/{id}` | `rental:read:own` or `rental:read:all` | Detail (ownership enforced) |
| POST | `/rentals/{id}/cancel` | `rental:cancel:own` / `rental:read:all` | Cancel |
| POST | `/rentals/{id}/approve` | `rental:approve` | Approve |
| POST | `/rentals/{id}/reject` | `rental:approve` | Reject with reason |
| POST | `/rentals/{id}/issue` | `rental:issue` | Mark issued |
| POST | `/rentals/{id}/return` | `rental:return` | Mark returned, compute late fee |
| GET | `/rentals/overdue` | `rental:read:all` | Overdue list |

### 6.6 Reports, Settings, Audit (Admin)

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| GET | `/reports/summary` | `report:read` | Totals by period |
| GET | `/reports/popular-gear` | `report:read` | Most rented items |
| GET | `/reports/utilization` | `report:read` | Gear utilization |
| GET | `/settings` | `settings:write` | Read settings |
| PUT | `/settings` | `settings:write` | Update settings |
| GET | `/audit-logs` | `audit:read` | Paginated audit log |

### 6.7 Sample Payloads

**POST `/rentals`**
```json
{
  "start_date": "2026-11-01",
  "end_date": "2026-11-03",
  "gear_item_ids": [4, 9]
}
```
**Response 201**
```json
{
  "id": 21,
  "status": "PENDING",
  "start_date": "2026-11-01",
  "end_date": "2026-11-03",
  "total_cost": "45.00",
  "total_deposit": "60.00",
  "items": [{ "gear_item_id": 4, "name": "2-Person Tent" }, { "gear_item_id": 9, "name": "Hiking Backpack" }]
}
```

**Error format**
```json
{ "detail": "Gear item 4 is not available for the selected dates" }
```

### 6.8 Status Codes

200 OK, 201 Created, 204 No Content, 400/422 validation error, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (double booking, invalid transition).

## 7. Core Business Logic

### 7.1 Availability Check
Two ranges overlap when `new_start <= existing_end AND new_end >= existing_start`.

```python
def is_available(db, gear_id, start, end) -> bool:
    conflict = (
        db.query(RentalItem)
        .join(Rental)
        .filter(
            RentalItem.gear_item_id == gear_id,
            Rental.status.in_(["APPROVED", "ISSUED"]),
            Rental.start_date <= end,
            Rental.end_date >= start,
        )
        .first()
    )
    return conflict is None
```

The check runs at request creation and again at approval, inside a transaction (with row locking on gear items, e.g. `SELECT ... FOR UPDATE`) to avoid race conditions.

### 7.2 Pricing
- `days = (end - start).days + 1`
- `total_cost = Σ(daily_rate × days)`
- `total_deposit = Σ deposit_amount`
- Rates are snapshotted into `rental_items` so later price changes do not affect existing rentals.

### 7.3 Late Fee
`late_days = max(0, (returned_date - end_date).days)`; `late_fee = late_days × late_fee_per_day`.

### 7.4 State Machine
Allowed transitions are held in a dictionary and enforced in `rental_service`; any other transition raises HTTP 409.

```python
ALLOWED = {
    "PENDING":  {"APPROVED", "REJECTED", "CANCELLED"},
    "APPROVED": {"ISSUED", "CANCELLED"},
    "ISSUED":   {"RETURNED"},
}
```

## 8. Frontend Design

### 8.1 Routing and Guards

| Route | Access |
|---|---|
| `/`, `/gear`, `/gear/:id` | Public |
| `/login`, `/register` | Guest |
| `/my-rentals`, `/rentals/new`, `/profile` | Customer+ |
| `/staff/rentals`, `/staff/overdue`, `/staff/gear-status` | Staff, Admin |
| `/admin/gear`, `/admin/categories`, `/admin/users`, `/admin/reports`, `/admin/settings`, `/admin/audit` | Admin |

`ProtectedRoute` accepts `requiredScopes` and redirects to `/login` (unauthenticated) or a 403 page (insufficient scopes).

### 8.2 State and Data
- `AuthContext` stores user, role, and scopes; exposes `hasScope(scope)`.
- TanStack Query handles server state (caching, refetch, invalidation).
- Axios interceptor attaches the token and handles 401 by attempting a refresh, then logout.
- Shared TypeScript types mirror backend schemas.

### 8.3 Key Screens
- **Catalog:** search, category filter, date range picker, availability badges.
- **Rental request:** select items, dates, price summary, submit.
- **My Rentals:** status badges, cancel action.
- **Staff queue:** tabs (Pending, Approved, Issued, Overdue) with action buttons.
- **Admin:** CRUD tables for gear, categories, users; report cards; audit table.

## 9. Error Handling and Logging
- Global FastAPI exception handlers return the standard `{ "detail": ... }` format.
- Structured application logs (request id, user id, path, status).
- Important domain events written to `audit_logs`.

## 10. Testing Strategy

| Type | Tools | Focus |
|---|---|---|
| Unit | pytest | availability, pricing, late fee, state machine |
| API/Integration | pytest + TestClient | auth, scope enforcement (401/403), rental flows, double booking |
| Frontend | Vitest + RTL | login, route guards, rental form |
| Manual / Demo | Swagger UI, browser | End-to-end per role |

Key security tests: each protected endpoint returns 401 without a token and 403 with an insufficient scope; customers cannot read others' rentals.

## 11. Deployment

- `docker-compose.yml` with services: `db` (PostgreSQL), `backend` (Uvicorn), `frontend` (Vite build served by Nginx).
- Environment variables: `DATABASE_URL`, `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`.
- Alembic migration and a seed script create the roles' demo accounts: admin, staff, customer, plus sample categories and gear.

## 12. Development Plan

| Phase | Tasks |
|---|---|
| 1 | Repo setup, Docker Compose, DB models, migrations, seed data |
| 2 | Auth, JWT, roles, scopes, dependency, tests |
| 3 | Category and gear APIs, search and availability |
| 4 | Rental APIs, state machine, pricing, late fee |
| 5 | Frontend: auth, guards, catalog, customer flow |
| 6 | Frontend: staff queue, admin pages, reports |
| 7 | Audit log, polish, tests, documentation, demo |

## 13. Future Enhancements
Email notifications, online payments, image uploads, reviews and ratings, QR code check-in/out, multi-branch support.
