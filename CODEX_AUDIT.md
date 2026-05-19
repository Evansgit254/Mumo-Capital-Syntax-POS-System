# Mumo POS — Independent Codex Audit
Date: 2026-05-19
Auditor: OpenAI Codex (Independent Review)

## Audit Summary
| Category | Issues Found | Severity |
|---|---:|---|
| Previous Fix Verification | 3 | Warning |
| Security | 9 | Critical |
| Data Integrity | 8 | Critical |
| API Completeness | 4 | Warning |
| Frontend | 7 | Warning |
| Performance | 5 | Warning |
| DevEx & Ops | 5 | Warning |
| TOTAL | 41 | Critical |

## Critical Findings

### CODEX-CRIT-001: Authenticated menu/table list endpoints can be tenant-spoofed
- Location: `server/src/routes/menus.ts:12`, `server/src/routes/tables.ts:12`, `server/src/index.ts:89-91`
- Issue: The same routers are mounted on public and protected paths, but the first `GET /` handlers read `x-tenant-id` directly and return before the authenticated handlers. On `/api/menus` and `/api/tables`, an authenticated caller can choose the tenant in the header and receive that tenant's menus/tables.
- Evidence: `menus.ts:14-19` and `tables.ts:14-19` use `req.headers['x-tenant-id']`; the protected `req.user!.tenantId` handlers at `menus.ts:26` and `tables.ts:26` are unreachable for the same method/path.
- Risk: Cross-tenant read access by changing `x-tenant-id`.
- Fix: Split public and protected routers, or use `getTenantId(req)` and ensure authenticated requests use `req.user.tenantId`, not raw headers.

### CODEX-CRIT-002: Public reservation router exposes check-in without authentication
- Location: `server/src/index.ts:77`, `server/src/routes/reservations.ts:39`
- Issue: The entire reservation router is mounted under `/api/public/reservations`; `POST /:id/checkin` only requires `x-tenant-id` and a guessed reservation ID.
- Evidence: `app.use('/api/public/reservations', extractTenant, reservationRoutes)` plus `router.post('/:id/checkin'...)` at `reservations.ts:39-69`.
- Risk: Guests or attackers can seat reservations and mark tables occupied without staff approval.
- Fix: Create a dedicated public reservations router with only lookup-safe endpoints, or require authentication for check-in.

### CODEX-CRIT-003: Public service request status endpoint is IDOR
- Location: `server/src/routes/requests.ts:64`
- Issue: `GET /api/requests/:id/status` fetches by `id` only and never checks `tenantId`.
- Evidence: `prisma.serviceRequest.findUnique({ where: { id: req.params.id }, select: ... })`.
- Risk: Anyone with a request ID can query another tenant's service request status.
- Fix: Use `findFirst({ where: { id: req.params.id, tenantId } })`.

### CODEX-CRIT-004: Activity and activity booking use ID-only lookups before tenant checks
- Location: `server/src/routes/activities.ts:45`, `server/src/routes/activity-bookings.ts:34`
- Issue: Public endpoints call `findUnique({ where: { id } })` then compare `tenantId` in application code.
- Evidence: `activity.findUnique({ where: { id: req.params.id } })`; `activity.findUnique({ where: { id: data.activityId } })`.
- Risk: The response is masked, but data from another tenant is still fetched by direct object reference. This pattern is fragile and bypasses database-level tenant scoping.
- Fix: Use `findFirst({ where: { id, tenantId } })` and update activity slot decrements with tenant-scoped `updateMany` or a compound unique.

### CODEX-CRIT-005: User uniqueness and login are globally scoped, not tenant scoped
- Location: `server/prisma/schema.prisma:102`, `server/src/routes/auth.ts:159`, `server/src/routes/users.ts:65`
- Issue: `User.email` is globally `@unique` even though `[tenantId, email]` also exists. Login looks up `where: { email }`; staff creation checks `findUnique({ where: { email } })`.
- Evidence: Schema has both `email String @unique` and `@@unique([tenantId, email])`.
- Risk: Same email cannot exist in two tenants, despite multi-tenant semantics. It also forces login identity to be global rather than tenant/domain-aware.
- Fix: Remove global `@unique` from `User.email`, normalize email case, and login by tenant/domain plus email or a globally explicit tenant selector.

### CODEX-CRIT-006: Login handler is vulnerable to username timing enumeration
- Location: `server/src/routes/auth.ts:159-168`
- Issue: Login returns before `bcrypt.compare()` when no user is found.
- Evidence: `if (!user) { throw unauthorized(...) }` occurs before `bcrypt.compare(password, user.password)`.
- Risk: Attackers can distinguish existing emails by response timing.
- Fix: Always compare against a constant dummy bcrypt hash when the user is absent.

### CODEX-CRIT-007: Payment settlement does not update order/table state transactionally
- Location: `server/src/routes/payments.ts:153`, `server/src/routes/payments.ts:187`
- Issue: Payment creation only inserts a payment; status update only changes the payment status. It does not atomically mark the order paid/served or release the table.
- Evidence: `payment.create` at `payments.ts:153-160`; `payment.update` at `payments.ts:187-190`.
- Risk: Settled bills can leave open orders and occupied tables, causing operational and reporting drift.
- Fix: Wrap settlement in `prisma.$transaction()` and update payment, order status, and table occupancy together.

### CODEX-CRIT-008: User deactivation does not revoke active refresh tokens
- Location: `server/src/routes/users.ts:177-179`
- Issue: Setting a user to `INACTIVE` updates only `User.status`.
- Evidence: No `refreshToken.updateMany` in the status route.
- Risk: Existing refresh tokens continue until expiry; a deactivated user may regain access by refreshing.
- Fix: In the same transaction, set `revokedAt` on all unrevoked refresh tokens for that user.

### CODEX-CRIT-009: Inventory audit log and PO item parent deletes can fail or orphan behavior is undefined
- Location: `server/prisma/schema.prisma:75`, `server/prisma/schema.prisma:92`
- Issue: `PurchaseOrderItem.inventoryItem` and `InventoryAuditLog.inventoryItem` have no explicit `onDelete`.
- Evidence: `@relation(fields: [inventoryItemId], references: [id])` with no `onDelete`.
- Risk: Deleting inventory items referenced by PO items or audit logs will fail at runtime, or deletion behavior will depend on Prisma defaults.
- Fix: Choose explicit behavior. Usually `Restrict` for audited inventory history, plus soft-delete inventory items instead of hard delete.

## Warnings

### CODEX-WARN-001: JWT algorithms are not explicitly pinned
- Location: `server/src/lib/jwt.ts:23-49`, `server/src/routes/super-admin-auth.ts:48`, `server/src/middleware/superAdminAuth.ts:34`
- Issue: Access, refresh, and super-admin JWT sign/verify calls omit `algorithm`/`algorithms`.
- Fix: Use `{ algorithm: 'HS256' }` on sign and `{ algorithms: ['HS256'] }` on verify.

### CODEX-WARN-002: Refresh token rotation is not atomic
- Location: `server/src/routes/auth.ts:269-282`
- Issue: Refresh revokes the old token, then creates the new token outside a transaction.
- Fix: Wrap revoke and new-token create in `prisma.$transaction()`.

### CODEX-WARN-003: Refresh token cleanup job can keep Node process alive and is not cleared on shutdown
- Location: `server/src/routes/auth.ts:325`, `server/src/index.ts:175`
- Issue: `setInterval` is created at module load and never `unref()`ed or cleared.
- Fix: Store the interval, call `unref()`, and clear it in shutdown.

### CODEX-WARN-004: Mass assignment remains in multiple write routes
- Location: `server/src/routes/menus.ts:80`, `menus.ts:106`, `customers.ts:67`, `customers.ts:99`, `vendors.ts:44`, `vendors.ts:67`, `inventory.ts:79`, `inventory.ts:115`, `tables.ts:113`, `tables.ts:182`, `reservations.ts:198`
- Issue: Validated request bodies are still spread directly into Prisma data.
- Fix: Explicitly map allowed fields in every create/update call.

### CODEX-WARN-005: Super-admin login has the same timing issue as tenant login
- Location: `server/src/routes/super-admin-auth.ts:30-36`
- Issue: Returns before `bcrypt.compare()` when the super admin email does not exist.
- Fix: Compare with a dummy hash on absent user.

### CODEX-WARN-006: Error handler leaks Prisma unique field names in production
- Location: `server/src/middleware/errorHandler.ts:33-36`
- Issue: P2002 responses expose exact unique constraint targets.
- Fix: Return a generic conflict message in production; log details server-side only.

### CODEX-WARN-007: Health check does not check database connectivity or version
- Location: `server/src/index.ts:68`
- Issue: `/health` returns status/message/timestamp only.
- Fix: Run a lightweight DB query, include version/build metadata, and fail non-200 when DB is unavailable.

### CODEX-WARN-008: Static SPA fallback is registered after the 404/error middleware
- Location: `server/src/index.ts:102-170`
- Issue: `app.use(errorHandler)` is registered before production static assets and catch-all route.
- Fix: Move static asset handling before the 404/error middleware.

### CODEX-WARN-009: Inventory audit-log endpoint is shadowed by `/:id`
- Location: `server/src/routes/inventory.ts:47`, `server/src/routes/inventory.ts:155`
- Issue: `GET /api/inventory/audit-log` is declared after `GET /api/inventory/:id`, so `audit-log` is treated as an item ID.
- Fix: Move `/audit-log` before `/:id`.

### CODEX-WARN-010: Client references missing vendor detail endpoint
- Location: `client/src/api/service.ts:253`, `server/src/routes/vendors.ts:19-93`
- Issue: Client calls `GET /api/vendors/:id`, but server has no `GET /:id` vendor route.
- Fix: Add `GET /api/vendors/:id` with tenant scoping, or remove the client API.

### CODEX-WARN-011: Frontend sends unsupported query params
- Location: `client/src/api/service.ts:328-334`, `server/src/routes/orders.ts:75`, `server/src/routes/payments.ts:13`, `server/src/routes/reservations.ts:97`
- Issue: `roomId`, `start`, and `end` params are sent by the client but ignored by server routes.
- Fix: Implement filters or remove misleading client parameters.

### CODEX-WARN-012: Important list endpoints are unpaginated
- Location: `orders.ts:78`, `payments.ts:19`, `reservations.ts:115`, `customers.ts:28`, `vendors.ts:25`, `vendors.ts:103`, `users.ts:28`, `menus.ts:29`, `tables.ts:29`
- Issue: These endpoints return all tenant records.
- Fix: Add `page`/`limit` or cursor pagination with sane caps.

### CODEX-WARN-013: String normalization is inconsistent
- Location: `server/src/routes/auth.ts:157`, `auth.ts:129`, `users.ts:74`, `onboarding.ts:112`
- Issue: Emails are not consistently lowercased or trimmed before storage/lookup; most string fields are not trimmed.
- Fix: Add Zod transforms for trim/lowercase and enforce normalized unique fields.

### CODEX-WARN-014: Decimal results are not rounded before storage
- Location: `server/src/routes/orders.ts:37-44`, `orders.ts:224-231`, `discounts.ts:51-66`
- Issue: Decimal arithmetic is used, but totals/discounts are not explicitly rounded to 2dp before writing `Decimal(10,2)`.
- Fix: Use `.toDecimalPlaces(2)` before persistence.

### CODEX-WARN-015: Schema is missing useful unique constraints
- Location: `server/prisma/schema.prisma:136`, `schema.prisma:357`
- Issue: Missing `@@unique([tenantId, name])` on `MenuItem`; missing `@@unique([userId, date, startTime])` on `Shift`.
- Fix: Add constraints after deduplicating existing data.

### CODEX-WARN-016: Several foreign-key/order fields lack obvious indexes
- Location: `server/prisma/schema.prisma`
- Issue: Missing indexes for common filters/joins such as `Order.tableId`, `Order.userId`, `OrderItem.orderId`, `OrderItem.menuItemId`, `Payment.orderId`, `Reservation.tableId`, `Shift.userId`, `ClockEvent.userId`, `ActivityBooking.activityId`, and `createdAt` order fields.
- Fix: Add targeted `@@index` entries based on query plans.

### CODEX-WARN-017: Client has weak accessibility coverage for icon/action buttons
- Location: `client/src`
- Issue: `rg '<button' ... | rg -v 'aria-label|aria-describedby|title=' | wc -l` returned `222`.
- Evidence first 10: `ReservationModal.tsx:47`, `:89`, `:97`, `:137`, `:144`, `TableActionModal.tsx:52`, `:70`, `:90`, `:97`, `NoteDrawer.tsx:29`.
- Fix: Add labels/titles to icon-only buttons and ensure visible text buttons remain accessible.

### CODEX-WARN-018: Polling continues while the tab is hidden
- Location: `client/src/pages/KDSPage.tsx:47`, `KDSPage.tsx:54`, `client/src/hooks/useOfflineOrders.ts:115`
- Issue: KDS polls every 10s and updates time every 1s; offline order retry polls every 30s. No `document.visibilityState` gating is present.
- Fix: Pause/refetch less frequently when the tab is hidden.

### CODEX-WARN-019: Build chunks are acceptable now, but charts dominate
- Location: client production build output
- Evidence: `vendor-charts-BN3riSJP.js 392.99 kB | gzip 114.86 kB`; no gzip chunk exceeded 200 KB.
- Fix: Lazy-load reports/executive analytics pages to keep the initial app path smaller.

### CODEX-WARN-020: Seed data lacks important UAT edge cases
- Location: `server/prisma/seed.ts`
- Issue: No inactive users, no cancelled reservations, no received purchase orders, no menu modifiers, and no below-minimum inventory items.
- Fix: Seed each edge case for both tenants.

### CODEX-WARN-021: Environment docs omit `RESEND_API_KEY`
- Location: `server/src/services/emailService.ts:5`, `server/.env.example`
- Issue: Code references `process.env.RESEND_API_KEY`; example only documents SMTP variables.
- Fix: Add `RESEND_API_KEY` or remove the fallback.

## Passed Verifications
- JWT secrets: `server/src/lib/jwt.ts:5-16` throws when `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing; no fallback string was present in that file.
- Prisma singleton: `rg "new PrismaClient" server/src` returned no results outside tests/seed; app code imports `server/src/lib/prisma.ts`.
- Monetary schema: `rg "Float" server/prisma/schema.prisma` returned zero results.
- Decimal arithmetic: reviewed `orders.ts`, `payments.ts`, `vendors.ts`, and `provisionTenant.ts`; monetary/quantity math uses `Decimal.plus/times/minus/greaterThan` rather than JS arithmetic. Non-money math remains for counters/coordinates.
- Refresh records: `RefreshToken` model exists at `schema.prisma:121`; tokens are stored hashed via `storeRefreshToken()` at `auth.ts:65-76`.
- Refresh rotation: old token is revoked at `auth.ts:270`; new refresh token is created at `auth.ts:282`; logout revokes at `auth.ts:311`.
- Rate limiting present on requested routes: `/auth/login`, `/auth/register`, `/auth/refresh`, `/api/onboarding/apply`, `/api/public/tenants/resolve`, `/api/activity-bookings`, and `/api/requests`.
- Helmet: `app.use(helmet())` is first middleware after app setup at `server/src/index.ts:46` and is unconditional.
- Raw SQL: `rg "$queryRaw|$executeRaw" server/src` returned no raw query usage.
- Super-admin JWT secret: super-admin signing and verification use `SUPER_ADMIN_JWT_SECRET`, separate from tenant `JWT_SECRET`.
- Production build: `client && npm run build` completed successfully with no warnings or errors.
- Image alt text: `rg '<img' ... | rg -v 'alt=' | wc -l` returned `0`.

## Performance Recommendations
1. Add pagination to high-growth list endpoints: orders, payments, reservations, customers, vendors, users, menus, tables.
2. Add missing FK and sort indexes listed in CODEX-WARN-016.
3. Replace PO receiving per-item loops with bulk reads/updates where possible; current transaction makes multiple DB calls per line item at `vendors.ts:200-247`.
4. Pause KDS/offline polling when `document.visibilityState === 'hidden'`.
5. Lazy-load reporting, executive analytics, and chart-heavy admin pages.

## Missing Test Coverage
- Multi-tenancy isolation for every ID-based route and list endpoint.
- Tenant spoofing on `/api/menus` and `/api/tables`.
- Refresh token rotation, reuse detection, logout revocation, and inactive-user token revocation.
- Rate limiting behavior on auth, onboarding, request, booking, and tenant resolution routes.
- Decimal precision and 2dp rounding for order totals, discounts, PO totals, and inventory adjustments.
- Payment settlement updating payment/order/table state atomically.
- PO receiving with partial quantities and duplicate receive attempts.
- Tenant provisioning end-to-end and failure rollback.
- Public reservation check-in authorization model.
- Inventory audit-log route ordering.

## Recommended Fix Priority
1. Fix all cross-tenant and unauthenticated access paths: CODEX-CRIT-001 through CODEX-CRIT-006.
2. Make payment settlement and user deactivation transactional: CODEX-CRIT-007 and CODEX-CRIT-008.
3. Decide explicit delete behavior and soft-delete strategy for inventory/audit records: CODEX-CRIT-009.
4. Pin JWT algorithms and normalize email/string handling.
5. Add pagination, indexes, route/API completeness fixes, and frontend accessibility improvements.
6. Add the missing critical-path tests before further feature work.
