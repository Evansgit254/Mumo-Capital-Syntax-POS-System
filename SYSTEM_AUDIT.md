# Mumo POS — System Audit Report

Generated: 2026-05-06  
Auditor: Antigravity

---

## Audit Summary

| Severity | Count |
|---|---|
| 🔴 Critical issues (must fix before deployment) | **14** |
| 🟡 Warnings (should fix before deployment) | **18** |
| 📝 Notes (low priority / informational) | **12** |
| ✅ Passed checks | **29** |

---

## 🔴 Critical Issues

### CRITICAL-001: Hardcoded JWT Fallback Secrets
- **Location:** [jwt.ts:5-6](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/lib/jwt.ts#L5-L6)
- **Issue:** `ACCESS_SECRET` and `REFRESH_SECRET` both have hardcoded fallback values (`'fallback_dev_secret'` and `'fallback_dev_refresh'`). If env vars are not set, the server silently uses publicly known strings.
- **Risk:** Complete authentication bypass. An attacker who reads this source code can forge valid JWTs for any user/tenant.
- **Fix:** Remove fallback values. Throw a fatal error at startup if secrets are not set:
  ```ts
  const ACCESS_SECRET = () => {
      const s = process.env.JWT_SECRET;
      if (!s) throw new Error('FATAL: JWT_SECRET not set');
      return s;
  };
  ```

---

### CRITICAL-002: Auth Routes Missing Rate Limiting
- **Location:** [auth.ts](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/auth.ts) (all 3 endpoints)
- **Issue:** `/auth/login`, `/auth/register`, and `/auth/refresh` have **zero rate limiting**. Login is the most brute-forceable endpoint.
- **Risk:** Credential stuffing, brute force password attacks, denial-of-service via registration spam.
- **Fix:** Add `express-rate-limit`:
  ```ts
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });
  router.post('/login', authLimiter, validate(loginSchema), ...);
  ```

---

### CRITICAL-003: `/auth/register` Is Completely Public — No Tenant Admin Guard
- **Location:** [auth.ts:14](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/auth.ts#L14)
- **Issue:** Anyone can call `POST /auth/register` providing any `tenantId` and `role` in the body (including `TENANT_ADMIN`). No authentication check — any anonymous user can create an admin account in any tenant.
- **Risk:** **Complete tenant takeover.** An attacker creates a `TENANT_ADMIN` account in any tenant, logs in, and has full admin access.
- **Fix:** Either (a) restrict registration to authenticated admins (`requireRole(TENANT_ADMIN)`), or (b) force all new accounts to `STAFF` role regardless of request body.

---

### CRITICAL-004: Public Routes Expose All Service Requests Without Auth
- **Location:** [index.ts:52](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/index.ts#L52), [requests.ts:78-89](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/requests.ts#L78-L89)
- **Issue:** `/api/requests` is mounted **outside** the protected block. The `GET /` endpoint only requires `x-tenant-id` header — any anonymous user who knows a tenant ID can read ALL service requests.
- **Risk:** Information disclosure — room numbers, categories, descriptions for any tenant.
- **Fix:** Split the routes: keep guest `POST` as public, protect `GET /` with `authenticate`.

---

### CRITICAL-005: Refresh Tokens Are Reusable — No Rotation Invalidation
- **Location:** [auth.ts:117-154](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/auth.ts#L117-L154)
- **Issue:** The refresh endpoint issues a new refresh token but **never invalidates** the old one. Both old and new tokens remain valid for 7 days. No server-side token store or blacklist.
- **Risk:** Stolen refresh token → unlimited access tokens for 7 days, even after legitimate user's token is refreshed.
- **Fix:** Implement server-side refresh token store (DB table or Redis). Invalidate old tokens on refresh. Invalidate all on logout.

---

### CRITICAL-006: All Monetary Fields Use Float — Currency Precision Loss
- **Location:** [schema.prisma](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/prisma/schema.prisma) — **15 fields**
- **Issue:** Every monetary field uses `Float` instead of `Decimal`:
  - `PurchaseOrder.totalCost`, `User.hourlyRate`, `MenuItem.price`
  - `Order.totalAmount`, `OrderItem.unitPrice/subtotal`, `Payment.amount`
  - `Customer.totalSpend`, `InventoryItem.currentStock/minStock/costPerUnit`
  - `TenantSettings.taxRate`, `Activity.price`
- **Risk:** `0.1 + 0.2 = 0.30000000000000004`. Over thousands of transactions → mismatched ledger balances, incorrect tax calculations, audit failures.
- **Fix:** Migrate all currency fields to `Decimal @db.Decimal(10, 2)`.

---

### CRITICAL-007: No `onDelete` Cascade Rules on Any Relation
- **Location:** [schema.prisma](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/prisma/schema.prisma) (all relations)
- **Issue:** No model specifies `onDelete` behavior. All FK constraints use Prisma default (`Restrict`):
  - Deleting a `Table` with `Orders` → **database error**
  - Deleting a `User` with `Shifts` → **database error**
  - Deleting an `Order` with `OrderItems` → **database error**
  - Deleting a `Tenant` → **impossible**
- **Risk:** Production operations crash when deleting records with dependencies.
- **Fix:** Add appropriate `onDelete` rules (Cascade for children, SetNull for optional refs).

---

### CRITICAL-008: No `@@index` on `tenantId` for Any Model
- **Location:** [schema.prisma](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/prisma/schema.prisma) (all models)
- **Issue:** **Zero `@@index` directives** on `tenantId`. Every tenant-scoped query does `WHERE tenantId = ?` — without indexes, these are full table scans.
- **Risk:** Performance degrades linearly. 10 tenants × 10K orders = every list query scans 100K rows.
- **Fix:** Add `@@index([tenantId])` to every tenant-scoped model (16 models).

---

### CRITICAL-009: `extractTenant` Middleware Fakes a STAFF User Object
- **Location:** [auth.ts:42](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/middleware/auth.ts#L42)
- **Issue:** Sets `req.user` to `{ tenantId, userId: 'guest', role: Role.STAFF }` cast as `any`. Public routes get **STAFF-level role**. `req.user!.id` returns `'guest'` — a non-existent user ID that will break FK constraints.
- **Risk:** (1) Public routes could pass STAFF role checks. (2) Writes using `req.user!.id` as `userId` create invalid FKs.
- **Fix:** Create a separate type for public request context. Don't overlap with `AuthPayload`.

---

### CRITICAL-010: `POST /api/payments` Missing Role Check
- **Location:** [payments.ts:54-87](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/payments.ts#L54-L87)
- **Issue:** `POST /api/payments` has no `requireRole()`. Any authenticated user including STAFF can create payment records.
- **Risk:** Staff can create fraudulent payment records (mark orders as paid without collecting money).
- **Fix:** Add `requireRole()` — at minimum STAFF, ideally MANAGER+ for fraud prevention.

---

### CRITICAL-011: User Status Not Checked on Login
- **Location:** [auth.ts:76-83](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/auth.ts#L76-L83)
- **Issue:** Login finds user by email and verifies password, but **never checks `user.status`**. A user with `status: 'INACTIVE'` can still log in and receive valid tokens.
- **Risk:** Deactivated employees retain full system access.
- **Fix:** Add check after password verification:
  ```ts
  if (user.status === 'INACTIVE') throw unauthorized('Account deactivated');
  ```

---

### CRITICAL-012: No HTTPS or Helmet Security Headers
- **Location:** [index.ts](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/index.ts)
- **Issue:** No `helmet` middleware, no HSTS, no CSP, no HTTPS enforcement. JWT tokens travel in plaintext over HTTP.
- **Risk:** Token interception via MITM. XSS via missing CSP headers.
- **Fix:** `npm install helmet` → `app.use(helmet())`.

---

### CRITICAL-013: `PurchaseOrder.items` Uses `Json` Without Type Safety
- **Location:** [schema.prisma:54](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/prisma/schema.prisma#L54)
- **Issue:** PO line items stored as a `Json` blob — no FK constraints on `inventoryItemId` values. The RECEIVED handler iterates over `order.items as any[]` — if JSON is malformed or an item was deleted, operation silently fails.
- **Risk:** Orphaned references, phantom inventory adjustments, no data integrity guarantees.
- **Fix:** Create a `PurchaseOrderItem` model with proper FK relations.

---

### CRITICAL-014: Table Transfer/Merge Not in Transaction
- **Location:** [tables.ts:258-266](file:///home/evans/Projects/Mumo%20Capital%20%26%20Syntax%20POS/server/src/routes/tables.ts#L258-L266)
- **Issue:** Transfer does 3 separate DB writes (move orders, update source, update target) **without** `$transaction`. If the second write fails, orders are moved but table statuses are wrong. Same for merge.
- **Risk:** Partial updates → tables in inconsistent state.
- **Fix:** Wrap all operations in `prisma.$transaction()`.

---

## 🟡 Warnings

### WARN-001: Missing Type Interfaces in `@mumo/types`
Missing: `Vendor`, `PurchaseOrder`, `PurchaseOrderItem`, `InventoryAuditLog`, `RolePermission`. Client uses `any` for all these.

### WARN-002: 70+ Instances of `: any` Across Codebase
- `client/src/api/service.ts`: 30+ instances
- `client/src/pages/`: 30+ in component props and callbacks
- `client/src/lib/analytics.ts`: All analytics functions use `any[]`
- `server/src/routes/shifts.ts`: `dateFilter: any`, `updateData: any`

### WARN-003: 16+ Hardcoded Color Values in TSX Files
- `POSPage.tsx` — `#2c2c2c`
- `SettingsPage.tsx` — `#121414`, `#c4c7c7`, `#f5f5f5`, `#d0d0d0`
- `TableManagementPage.tsx` — `#f0f0f0`
- `TenantPage.tsx` — `#008B8B` (3 instances)
- `ReportsPage.tsx` — `#008B8B`, `#FFBF00`, `#6366F1`, `#EC4899`
- `ReservationsPage.tsx`, `Skeleton.tsx` — `#2c2c2c`
- `index.css` — `#e0e0e0`, `#383838`, `#2c2c2c`

These violate the DESIGN.md principle that all colours should use CSS variable tokens.

### WARN-004: `LoginPage.tsx` Uses Direct Axios Import
Bypasses the `api` client from `service.ts` and its interceptors.

### WARN-005: `POST /api/customers` Missing Role Guard
Any authenticated user can create customers; `PUT` requires MANAGER+. Inconsistent.

### WARN-006: `GET /api/customers` Missing Role Guard
Any authenticated user sees customer data (names, emails, spending, loyalty points).

### WARN-007: `users.ts` Uses Inline `require('bcryptjs')` — Hash Incompatibility
- `auth.ts` uses `import bcrypt from 'bcrypt'` (native) with 12 rounds
- `users.ts` uses `require('bcryptjs')` (JS) with 10 rounds
- **Risk:** Users created via `/api/users` may not be able to log in via `/auth/login`.

### WARN-008: Default Password `Mumo1234!` for Created Users
If no password provided in `POST /api/users`, this known default is used.

### WARN-009: `POST /api/users` Missing Zod Validation
Manually checks `if (!email || !firstName || !role)` — no email format or password strength validation.

### WARN-010: `PUT /api/users/:id/role` and `/status` Missing Zod Validation
Basic runtime checks but no `validate()` middleware.

### WARN-011: Table Settle Not In Transaction
`POST /api/tables/:id/settle` does 2 separate DB writes without `$transaction`.

### WARN-012: Check-In Not In Transaction
Both public and protected check-in routes update reservation then table as separate operations.

### WARN-013: No 404 Page
Catch-all route silently redirects to `/dashboard` instead of showing a proper 404.

### WARN-014: `console.error()` in 10 Production Route Handlers
Should use a structured logger (winston/pino) that respects log levels.

### WARN-015: 6 Route Files Create Separate PrismaClient Instances
`tenants-public.ts`, `requests.ts`, `activities.ts`, `activity-bookings.ts`, `shifts.ts`, `clock-events.ts` all do `new PrismaClient()` instead of importing the singleton from `../lib/prisma`.
Risk: Database connection pool exhaustion under load.

### WARN-016: Reservation Create/Update Missing Role Guard
Any authenticated user can create/update reservations. `DELETE` correctly requires MANAGER+.

### WARN-017: Order List/Detail Missing Role Guard
Any authenticated user can list all orders. Likely intentional for POS but undocumented.

### WARN-018: JWT Tokens Persisted to localStorage via Zustand
`localStorage` is accessible to any JS on the page. XSS → token theft.

---

## 📝 Notes

| # | Title | Detail |
|---|---|---|
| NOTE-001 | README references wrong dir | Says `shared/` but actual directory is `types/` |
| NOTE-002 | Seed missing edge cases | No inactive users, unavailable menu items, cancelled orders, or empty tenant |
| NOTE-003 | InventoryAuditLog missing FK | `inventoryItemId` is plain String — no referential integrity |
| NOTE-004 | OrderItem missing tenantId | Isolated via parent Order, but direct query bypasses tenant scope |
| NOTE-005 | Activity.price stored as Float | Same precision concern as CRITICAL-006 |
| NOTE-006 | Discount codes are hardcoded | No DB model, no tenant scoping, no expiry/usage limits |
| NOTE-007 | `checkoutFolio` calls non-existent endpoint | `POST /api/payments/folio` never defined in server routes |
| NOTE-008 | CORS single origin | Only allows one frontend URL — breaks multi-tenant subdomains |
| NOTE-009 | AuditLog qty fields use Float | Should match InventoryItem.currentStock type |
| NOTE-010 | TenantSettings lacks type interfaces | `outletType`, `operatingHours`, `receiptConfig` not in shared types |
| NOTE-011 | Shared UI components not universally adopted | Some pages use inline patterns instead of EmptyState/FormField/Skeleton |
| NOTE-012 | activities.ts uses inline role checks | Uses `if (role !== ...)` instead of `requireRole()` middleware |

---

## ✅ Passed Checks (29)

### Database & Schema
- ✅ All tenant-scoped models have `tenantId` field
- ✅ All DateTime fields use `DateTime` type
- ✅ Proper relation definitions (1:N, M:N)
- ✅ Composite unique constraints where appropriate (`[tenantId, email]`, `[tenantId, number]`, `[tenantId, sku]`, `[tenantId, role]`)
- ✅ `TenantSettings` has `@unique` on `tenantId` (1:1)

### Server API — Security
- ✅ `authenticate` validates JWT token
- ✅ `authenticate` cross-validates `x-tenant-id` header against JWT `tenantId`
- ✅ `requireRole()` correctly checks user role
- ✅ Auth middleware handles: expired (401), malformed (401), missing (401), wrong tenant (403)
- ✅ `PUT /api/tables/batch` validates all IDs belong to tenant before transaction

### Server API — Data Integrity
- ✅ Inventory adjust wraps stock update + audit log in `$transaction`
- ✅ PO RECEIVED uses `receivedItems` (confirmed quantities) when provided
- ✅ Order creation calculates prices server-side (prevents price manipulation)
- ✅ Discounts verify order belongs to tenant

### Server API — Input Validation
- ✅ Zod validation on auth, menu, order, table, payment, reservation, inventory, customer, discount, vendor, PO, permission, tenant-settings
- ✅ `validate()` middleware replaces `req.body` with parsed result

### Server API — Error Handling
- ✅ Centralized error handler catches AppError, PrismaClientKnownRequestError, PrismaClientValidationError, SyntaxError
- ✅ Stack traces suppressed in production
- ✅ All route handlers use try/catch with `next(err)`

### Authentication
- ✅ JWT uses HS256 algorithm
- ✅ Access token expiry = 15 min
- ✅ Refresh token expiry = 7 days
- ✅ JWT secret read from env

### Multi-Tenancy
- ✅ All CRUD operations scope by `tenantId` from JWT — verified across orders, tables, inventory, payments, reservations, customers, shifts, clock-events
- ✅ `POST` operations derive tenantId from JWT, not request body
- ✅ Public `resolveTenant` only returns `{ tenantId, tenantName }` — no internal data leaked
- ✅ Seed creates fully isolated records per tenant

### Frontend
- ✅ Staff routes wrapped in `<ProtectedRoute>`
- ✅ Admin routes wrapped with `allowedRoles={[Role.TENANT_ADMIN]}`
- ✅ Public routes don't render inside `<Shell>`
- ✅ JWT refresh interceptor correctly queues in-flight requests (failedQueue pattern)
- ✅ `clearSession()` resets all session fields to null

---

## Recommended Fix Order

### 🔴 Security (Fix Immediately)

| Priority | ID | Title |
|---|---|---|
| 1 | CRITICAL-001 | Remove hardcoded JWT fallback secrets |
| 2 | CRITICAL-003 | Lock down `/auth/register` |
| 3 | CRITICAL-002 | Add rate limiting to auth routes |
| 4 | CRITICAL-011 | Check user.status on login |
| 5 | CRITICAL-005 | Implement refresh token invalidation |
| 6 | CRITICAL-004 | Fix `/api/requests` GET — add auth |
| 7 | CRITICAL-009 | Fix `extractTenant` fake STAFF role |
| 8 | CRITICAL-010 | Add role guard to `POST /api/payments` |
| 9 | CRITICAL-012 | Add Helmet security headers |
| 10 | WARN-008 | Remove default password |
| 11 | WARN-018 | Stop persisting JWTs to localStorage |
| 12 | WARN-007 | Standardize bcrypt — fix hash incompatibility |

### 🟡 Data Integrity (Fix Before Production Data)

| Priority | ID | Title |
|---|---|---|
| 13 | CRITICAL-006 | Migrate Float → Decimal for money |
| 14 | CRITICAL-007 | Add onDelete cascade rules |
| 15 | CRITICAL-008 | Add @@index on tenantId |
| 16 | CRITICAL-013 | Refactor PO items from JSON to relation |
| 17 | CRITICAL-014 | Wrap transfer/merge in transactions |
| 18 | WARN-011 | Wrap settle in transaction |
| 19 | WARN-012 | Wrap check-in in transaction |
| 20 | WARN-015 | Replace PrismaClient instances with singleton |
| 21 | WARN-009 | Add Zod to user creation |
| 22 | WARN-010 | Add Zod to user role/status updates |

### 🖌️ Frontend (Fix For Quality)

| Priority | ID | Title |
|---|---|---|
| 23 | WARN-003 | Replace hardcoded colors with CSS variables |
| 24 | WARN-002 | Replace `: any` with proper interfaces |
| 25 | WARN-001 | Add missing types to @mumo/types |
| 26 | WARN-013 | Create proper 404 page |
| 27 | WARN-004 | Replace direct axios in LoginPage |

### 🔧 DX (Fix For Maintainability)

| Priority | ID | Title |
|---|---|---|
| 28 | WARN-014 | Replace console.error with structured logger |
| 29 | WARN-005 | Add role guard to customer creation |
| 30 | WARN-006 | Add role guard to customer listing |
| 31 | WARN-016 | Add role guards to reservation create/update |
| 32 | WARN-017 | Document order list access or add role guard |

---

## Cross-References

### vs. Stitch Project (`projects/14780943935040185205`)
- ✅ All 30 screen IDs exist in Stitch project
- ✅ Design tokens match DESIGN.md
- ✅ Device type = MOBILE for all screens

### vs. IMPLEMENTATION_REPORT.md

| Claim | Verified |
|---|---|
| "30/30 Screens" | ✅ All referenced in App.tsx |
| "17 Prisma Models" | ✅ 17 models in schema.prisma |
| "Shared UI components" | ✅ EmptyState, FormField, Skeleton exist |
| "JWT secure token signing" | ⚠️ Undermined by CRITICAL-001 |
| "resolveTenant hostname mapping" | ✅ Confirmed |
| "Production Checklist" | ⚠️ Several items aspirational |

---

*End of Audit Report*
