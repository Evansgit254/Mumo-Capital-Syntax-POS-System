# Mumo POS — Deep CRUD & Interaction Audit
Date: 2026-05-21
Auditor: OpenAI Codex

## Summary
| Phase | Findings | Critical | Warning | Pass |
|---|---:|---:|---:|---:|
| CRUD Operations | 14 | 5 | 9 | 15 |
| Modals & Forms | 8 | 1 | 7 | 12 |
| State Management | 3 | 0 | 3 | 8 |
| Error Handling | 4 | 1 | 3 | 4 |
| Navigation & Routing | 5 | 1 | 4 | 6 |
| Data Display | 5 | 0 | 5 | 3 |
| Integration Points | 9 | 4 | 5 | 6 |
| Mobile | 4 | 0 | 4 | 5 |
| Concurrent Users | 3 | 3 | 0 | 2 |
| TOTAL | 55 | 15 | 40 | 61 |

## Critical Findings
### DEEP-CRIT-001: Table-order race is still possible despite transaction
- Phase: Concurrent Users / Integration Points
- Location: `server/src/routes/orders.ts:217`
- Issue: Order creation now runs in a transaction, but it still performs `findFirst({ isOccupied: false })` and later `table.update()`. Under default isolation, two concurrent transactions can both read the same available table before either marks it occupied.
- Evidence: table availability read at `server/src/routes/orders.ts:221-224`; table update happens later at `server/src/routes/orders.ts:270-275`.
- Risk: Two cashiers can still create separate active orders on the same table.
- Fix: Replace the read-then-update with a conditional write: `updateMany({ where: { id: tableId, tenantId, isOccupied: false }, data: { isOccupied: true } })`, assert `count === 1`, then create the order in the same transaction. Alternatively use serializable isolation and retry conflicts.

### DEEP-CRIT-002: Inventory decrement can still go negative under concurrency
- Phase: Concurrent Users / Data Integrity
- Location: `server/src/routes/inventory.ts:264`
- Issue: Adjustment now uses a transaction and atomic `decrement`, but the sufficient-stock check is still based on a prior read inside the transaction. Two concurrent reductions can both pass the read check and both decrement.
- Evidence: stock check at `server/src/routes/inventory.ts:273-279`; decrement at `server/src/routes/inventory.ts:281-284`.
- Risk: Stock can become negative and audit logs will show inconsistent previous balances.
- Fix: For reductions use `updateMany({ where: { id, tenantId, deletedAt: null, currentStock: { gte: quantityDecimal } }, data: { currentStock: { decrement: quantityDecimal } } })`, assert count, then fetch updated row and write audit log.

### DEEP-CRIT-003: PO create still accepts cross-tenant inventory item IDs
- Phase: CRUD Operations / Security
- Location: `server/src/routes/vendors.ts:147`
- Issue: Vendor ownership is now checked, but each `inventoryItemId` in PO items is still written directly without verifying tenant ownership.
- Evidence: vendor tenant check at `server/src/routes/vendors.ts:141-145`; direct `inventoryItemId: item.inventoryItemId` at `server/src/routes/vendors.ts:160-164`.
- Risk: A manager can create PO line items referencing another tenant's inventory IDs. Receipt later throws or can leave bad PO data attached to the current tenant.
- Fix: Before creating the PO, fetch all submitted inventory items with `{ id: { in: ids }, tenantId, deletedAt: null }`; reject if count differs from the unique submitted IDs.

### DEEP-CRIT-004: Table settlement splits existing orders with client-side multi-call payments
- Phase: Integration Points / Data Integrity
- Location: `client/src/pages/CheckoutPage.tsx:112`
- Issue: TableDetails no longer recreates orders, but Checkout now settles table orders by looping through `orderIds` and creating one payment per order from the client.
- Evidence: payment loop at `client/src/pages/CheckoutPage.tsx:119-126`; table release at `client/src/pages/CheckoutPage.tsx:128-129`.
- Risk: If payment 1 succeeds and payment 2 fails, the table is partially settled with no rollback. The split amount `amount / orderIds.length` also does not match each order's actual total.
- Fix: Add a backend endpoint like `POST /api/tables/:id/settle-orders` that accepts order IDs/payment method, validates each order total, creates all payments, marks orders paid, and releases the table in one transaction.

### DEEP-CRIT-005: Public guest check-in still calls a non-existent endpoint
- Phase: Integration Points / Navigation
- Location: `client/src/api/service.ts:318`, `server/src/routes/reservations.ts:21`
- Issue: The client calls `POST /api/public/reservations/:id/checkin`, but the public reservation router only exposes lookup and `GET /:id`; check-in exists only on the authenticated staff router.
- Evidence: client call at `client/src/api/service.ts:318-319`; public routes at `server/src/routes/reservations.ts:21` and `server/src/routes/reservations.ts:52`; staff route at `server/src/routes/reservations.ts:272-275`.
- Risk: Mobile check-in reaches confirmation then fails with 404/405 in production.
- Fix: Either add a public check-in endpoint with tenant extraction and safe validation, or change `CheckInPage` to submit an application/request that staff completes.

### DEEP-CRIT-006: External/public order creation is unvalidated and bypasses table occupancy
- Phase: CRUD Operations / Security
- Location: `server/src/routes/orders.ts:13`
- Issue: `/external` reads `x-tenant-id` and raw body items without Zod validation, does not verify table belongs to tenant, does not check occupancy, and does not mark the table occupied.
- Evidence: raw body read at `server/src/routes/orders.ts:15-16`; order create uses `tenantId` and `tableId` directly at `server/src/routes/orders.ts:49-56`.
- Risk: Public room-service orders can attach to arbitrary table IDs, bypass occupancy/session rules, and crash on malformed `items`.
- Fix: Apply a public order schema, verify the table with `{ id, tenantId }`, and decide whether guest orders should occupy the table or attach to an existing stay/session.

### DEEP-CRIT-007: Folio checkout creates payments but does not settle orders
- Phase: CRUD Operations / Integration Points
- Location: `server/src/routes/payments.ts:57`
- Issue: `/api/payments/folio` validates tenant-owned orders and creates payments, but never updates order status to `PAID` or releases the room/table.
- Evidence: payments are created at `server/src/routes/payments.ts:81-92`; response is returned at `server/src/routes/payments.ts:99-107` with no order/table updates.
- Risk: Guest folios can appear paid while orders remain open elsewhere in the system.
- Fix: In the same transaction, update all charged orders to `PAID` and release the room/table only when no unpaid room orders remain.

### DEEP-CRIT-008: Manager still has access to admin routes that policy says are tenant-admin only
- Phase: Navigation & Routing
- Location: `client/src/App.tsx:120`
- Issue: The stated policy says Manager should not access `/admin/analytics`, `/admin/tables`, or `/admin/tenant`, but the route guard still allows `Role.MANAGER`.
- Evidence: `ProtectedRoute allowedRoles={[Role.TENANT_ADMIN, Role.MANAGER]}` wraps those routes at `client/src/App.tsx:120-123`.
- Risk: Managers can directly navigate to tenant configuration, floor-plan admin, and executive analytics.
- Fix: Restrict `/admin/tenant`, `/admin/tables`, and `/admin/analytics` to `Role.TENANT_ADMIN` unless the product policy is changed.

### DEEP-CRIT-009: Guest folio checked-in filter uses a status the server never emits
- Phase: Integration Points / API Completeness
- Location: `client/src/api/service.ts:341`
- Issue: Client requests reservations with `status: 'checked-in'`, while the server uses enum value `SEATED`.
- Evidence: client filter at `client/src/api/service.ts:341-342`; server check-in writes `ReservationStatus.SEATED` at `server/src/routes/reservations.ts:286-288`.
- Risk: Guest folio screens can show no checked-in guests even when reservations are seated.
- Fix: Use `status: 'SEATED'` or centralize reservation status constants from shared types.

### DEEP-CRIT-010: User email normalization fix is incomplete
- Phase: CRUD Operations / Data Integrity
- Location: `server/src/routes/users.ts:80`
- Issue: The route checks for `email.toLowerCase().trim()` but stores raw `email`.
- Evidence: duplicate check at `server/src/routes/users.ts:80-83`; create writes `email` directly at `server/src/routes/users.ts:90-93`.
- Risk: Case/space variants can pass unique checks depending on database collation and will later cause login/lookup inconsistencies.
- Fix: Assign `const normalizedEmail = email.trim().toLowerCase()` and use it for both duplicate check and create.

### DEEP-CRIT-011: Purchase order UI still has no create-order flow
- Phase: Modals & Forms / CRUD Operations
- Location: `client/src/pages/vendors/VendorPage.tsx:106`
- Issue: The `New Order` button does nothing when the Purchase Orders tab is active.
- Evidence: `onClick={() => activeTab === 'vendors' ? setIsVendorModalOpen(true) : null}` at `client/src/pages/vendors/VendorPage.tsx:106-108`.
- Risk: The server exposes PO create, but users cannot create purchase orders from the implemented UI.
- Fix: Implement a PO modal/drawer with vendor selection and validated line items, or route to a real PO creation page.

### DEEP-CRIT-012: PO list displays the wrong total field
- Phase: Data Display / CRUD Operations
- Location: `client/src/pages/vendors/VendorPage.tsx:229`
- Issue: Server serializes PO totals as `totalCost`, but UI displays `po.totalAmount`.
- Evidence: server returns `totalCost` at `server/src/routes/vendors.ts:108-115`; UI reads `po.totalAmount` at `client/src/pages/vendors/VendorPage.tsx:229-230`.
- Risk: Purchase orders display zero totals even when costs exist.
- Fix: Display `po.totalCost` and format it with tenant currency.

### DEEP-CRIT-013: Table settle endpoint can release tables with active unpaid orders
- Phase: Integration Points / Data Integrity
- Location: `server/src/routes/tables.ts:285`
- Issue: `POST /api/tables/:id/settle` marks a table available and intentionally does not verify payment/order state.
- Evidence: comments at `server/src/routes/tables.ts:299-303`; update sets `isOccupied: false` at `server/src/routes/tables.ts:305-309`.
- Risk: A client call can free an occupied table while orders remain pending/preparing/ready.
- Fix: Require the endpoint to verify all non-cancelled orders are `PAID`, or make it private to the transactional payment-settlement endpoint.

### DEEP-CRIT-014: Reservation check-in marks table occupied without checking table conflict
- Phase: Concurrent Users / Integration Points
- Location: `server/src/routes/reservations.ts:309`
- Issue: Reservation status update is now atomic, but table occupancy is updated unconditionally afterward.
- Evidence: table update at `server/src/routes/reservations.ts:309-314` has only `where: { id: reservation.tableId }`.
- Risk: A reservation can check into a table already occupied by a POS order or another checked-in guest.
- Fix: Use `updateMany({ where: { id: tableId, tenantId, isOccupied: false }, data: { isOccupied: true } })` and reject if count is zero.

### DEEP-CRIT-015: Payment amount validation allows partial payment to mark an order paid
- Phase: CRUD Operations / Data Integrity
- Location: `server/src/routes/payments.ts:167`
- Issue: The payment route rejects amounts greater than order total, but accepts smaller amounts and still marks the order `PAID`.
- Evidence: only `greaterThan(order.totalAmount)` is checked at `server/src/routes/payments.ts:167-169`; order is marked paid at `server/src/routes/payments.ts:183-187`.
- Risk: Orders can be closed as paid for any positive underpayment.
- Fix: Compare cumulative completed payments plus new amount against `order.totalAmount`; mark `PAID` only when fully paid.

## Warnings
### DEEP-WARN-001: PO receipt still has no submit-time completeness validation
- Phase: Modals & Forms
- Location: `client/src/pages/vendors/VendorPage.tsx:52`
- Issue: Receipt modal sends parsed quantities, but it does not prevent blank/negative/NaN values before `markReceivedMutation`.
- Fix: Disable Confirm until every line has a finite non-negative quantity and show line-level errors.

### DEEP-WARN-002: Vendor form still sends `address`, which server/schema ignore
- Phase: Modals & Forms / CRUD Operations
- Location: `client/src/pages/vendors/VendorPage.tsx:346`, `server/src/routes/vendors.ts:61`
- Issue: Client form includes address, but server create/update maps only name/contact/email/phone/categories.
- Fix: Add `address` to the Prisma model and validators, or remove the field from UI.

### DEEP-WARN-003: Shift list remains unpaginated
- Phase: CRUD Operations / Performance
- Location: `server/src/routes/shifts.ts:31`
- Issue: Staff and managers can request all shifts in a range with no `take`/`skip`.
- Fix: Add pagination or enforce a maximum date span.

### DEEP-WARN-004: Service request list remains unpaginated and lacks lifecycle update
- Phase: CRUD Operations / API Completeness
- Location: `server/src/routes/requests.ts:81`
- Issue: Protected request list returns all service requests; no protected update endpoint exists for status/assignment.
- Fix: Add paginated list and `PATCH /api/requests/:id` with explicit whitelisted status/assignee fields.

### DEEP-WARN-005: Activity and ActivityBooking still do not have complete staff CRUD
- Phase: CRUD Operations
- Location: `server/src/routes/activities.ts:65`, `server/src/routes/activity-bookings.ts:24`
- Issue: Activity has create/update but no delete/archive; ActivityBooking has public create but no staff list/update/cancel endpoints.
- Fix: Add archive/cancel lifecycle endpoints and staff-visible booking management.

### DEEP-WARN-006: Modal accessibility fixes are not applied consistently
- Phase: Modals & Forms
- Location: `client/src/pages/vendors/VendorPage.tsx:261`, `client/src/pages/inventory/InventoryPage.tsx:440`, `client/src/pages/admin/WorkforcePage.tsx:365`
- Issue: `Dialog` exists and ModifierModal uses it, but many page-level modals still use custom fixed overlays without focus trap/focus return/Escape behavior.
- Fix: Migrate all modals/drawers to `client/src/components/ui/Dialog.tsx` or a shared drawer equivalent.

### DEEP-WARN-007: `Dialog` focus return is not explicit
- Phase: Modals & Forms / Accessibility
- Location: `client/src/components/ui/Dialog.tsx:61`
- Issue: Focus is trapped and Escape/backdrop close works, but the component does not explicitly restore focus to the trigger element on close.
- Fix: Capture `document.activeElement` when opening and restore it after close, or use a dialog library that handles this.

### DEEP-WARN-008: Modifier currency remains hardcoded
- Phase: Data Display
- Location: `client/src/components/pos/ModifierModal.tsx:30`
- Issue: ModifierModal imports `formatCurrency`, but sets `currency` to `'KES'` regardless of tenant settings.
- Fix: Read tenant settings or pass currency from the POS page.

### DEEP-WARN-009: Hardcoded currency remains in major pages
- Phase: Data Display
- Location: `client/src/pages/vendors/VendorPage.tsx:229`, `client/src/pages/TableDetailsPage.tsx:155`, `client/src/pages/admin/ExecutiveAnalyticsPage.tsx:114`, `client/src/pages/RoomServicePage.tsx:196`
- Issue: Several screens still display `KES` or `$` directly instead of tenant settings.
- Fix: Use `formatCurrency` everywhere monetary values render.

### DEEP-WARN-010: Checkout normal POS flow still fire-and-forgets table settle
- Phase: Error Handling / Integration Points
- Location: `client/src/pages/CheckoutPage.tsx:56`
- Issue: After payment success, `tableService.settle(tableId)` is called but not awaited or caught.
- Evidence: `tableService.settle(tableId);` at `client/src/pages/CheckoutPage.tsx:57-58`.
- Fix: Remove this client call if payment.create releases tables correctly, or await it inside a backend transaction.

### DEEP-WARN-011: Checkout table settlement uses floating split amounts
- Phase: Data Integrity
- Location: `client/src/pages/CheckoutPage.tsx:119`
- Issue: `amount / orderIds.length` can produce more than two decimals and does not match each order's real total.
- Fix: Pay each order by its own server-side outstanding balance.

### DEEP-WARN-012: Inventory adjustment client/server naming is still fragile
- Phase: Modals & Forms
- Location: `client/src/pages/inventory/InventoryPage.tsx:639`, `server/src/routes/inventory.ts:260`
- Issue: Audit confirmed server expects `adjustmentType`; ensure the client mutation sends that exact key. Previous UI used `type`, and this path should be covered by tests.
- Fix: Add a typed client DTO and integration test for WASTE and PURCHASE adjustments.

### DEEP-WARN-013: Email normalization should apply to vendor/customer forms too
- Phase: CRUD Operations / Data Integrity
- Location: `client/src/pages/vendors/VendorPage.tsx:402`, `server/src/routes/customers.ts:75`
- Issue: Forms validate email syntax but do not consistently trim/lowercase before storage.
- Fix: Normalize email at server boundaries for all business records.

### DEEP-WARN-014: Dashboard polling still runs every 15 seconds in hidden tabs
- Phase: Performance
- Location: `client/src/pages/DashboardPage.tsx:42`
- Issue: KDS/offline retry are visibility-aware, but dashboard polling is still fixed `refetchInterval: 15000`.
- Fix: Use a visibility-aware function and `refetchIntervalInBackground: false`.

### DEEP-WARN-015: Small-text and touch-target review still needed
- Phase: Mobile
- Location: `client/src/components/layout/Shell.tsx:188`, `client/src/pages/admin/TableManagementPage.tsx:278`
- Issue: The app still has many `text-[10px]`/`text-xs` operational labels and `h-8 w-8` controls.
- Fix: Ensure critical statuses/prices/order numbers are at least 12px and interactive controls are at least 44x44 on mobile.

### DEEP-WARN-016: Floor-plan editor remains desktop-sized
- Phase: Mobile
- Location: `client/src/pages/admin/TableManagementPage.tsx:221`
- Issue: The table editor still renders a 20x20 grid with 40px tracks and extra padding.
- Fix: Gate the editor behind a desktop breakpoint or add a responsive/mobile editor.

### DEEP-WARN-017: Menu route depends on page-level guard
- Phase: Navigation & Routing
- Location: `client/src/App.tsx:95`, `client/src/pages/MenuManagerPage.tsx:32`
- Issue: `/menu` has no route-level role guard, although the page redirects non-admin/manager users internally.
- Fix: Add a route-level guard for consistency with the navigation policy.

### DEEP-WARN-018: Reports CSV labels still hardcode KES
- Phase: Data Display
- Location: `client/src/pages/ReportsPage.tsx:169`
- Issue: UI formatting is partially improved, but export column labels still hardcode KES.
- Fix: Use tenant currency in export headers and generated reports.

### DEEP-WARN-019: `purchaseOrderService.getAll` fixed, but VendorPage uses `any`
- Phase: State Management / Type Safety
- Location: `client/src/pages/vendors/VendorPage.tsx:218`
- Issue: The service now returns a paginated envelope, but the page casts `purchaseOrders as any` instead of using the typed `data` field.
- Fix: Use the typed `PaginatedResponse<PurchaseOrder>` directly and remove `any`.

### DEEP-WARN-020: Shift create still lacks end-after-start validation
- Phase: Modals & Forms / CRUD Operations
- Location: `server/src/routes/shifts.ts:13`, `client/src/pages/admin/WorkforcePage.tsx:97`
- Issue: Staff role was removed from create, but neither client nor server rejects `endTime <= startTime`.
- Fix: Add Zod refinement on the server and disable/save-error in the shift modal.

## Previously Critical Items Now Passing
- Vendor `/orders` route ordering fixed: `/orders` routes now appear before `/:id` in `server/src/routes/vendors.ts:78-83`.
- PO receipt payload is mostly aligned: client sends `receivedQty` at `client/src/pages/vendors/VendorPage.tsx:55-58`; server expects it at `server/src/routes/vendors.ts:210-213`.
- PO receipt inventory lookup is tenant-scoped: `server/src/routes/vendors.ts:232-236`.
- Table batch upsert no longer updates foreign tenant tables directly: `server/src/routes/tables.ts:159-184`.
- Reservation check-in status update is atomic: `server/src/routes/reservations.ts:280-301`.
- Activity booking slot decrement is conditional and transactional: `server/src/routes/activity-bookings.ts:33-70`.
- Shift creation no longer allows staff and verifies target tenant: `server/src/routes/shifts.ts:80-90`.
- Checkout hooks are now declared before conditional returns: `client/src/pages/CheckoutPage.tsx:48-146`.
- TableDetails no longer loads active order items back into cart: `client/src/pages/TableDetailsPage.tsx:53-65`.
- Purchase-order service now expects a paginated envelope: `client/src/api/service.ts:266-271`.
- Cart line IDs now include modifier selection: `client/src/store/useStore.ts:150-180`.
- Logout action now clears session, super-admin state, cart, and UI sidebar state: `client/src/store/useStore.ts:109-123`.
- Super-admin applications route is guarded: `client/src/App.tsx:63-67`.
- Login now honors deep-link return path: `client/src/pages/LoginPage.tsx:64-68`.
- ModifierModal resets selected modifiers between items and uses the shared Dialog: `client/src/components/pos/ModifierModal.tsx:33-38`, `client/src/components/pos/ModifierModal.tsx:67-73`.

## CRUD Operation Matrix
| Model | Current Result | Evidence |
|---|---|---|
| MenuItem | Mostly pass | Server validates and uses Decimal; client still has route-level guard gap and money input uses numeric parsing. |
| Order + OrderItem | Critical | Protected create uses Decimal and notes/modifiers, but table conflict remains read-then-write at `server/src/routes/orders.ts:221-275`; public create is unvalidated at `server/src/routes/orders.ts:13-56`. |
| Table | Critical | Batch cross-tenant update improved; settle can release unpaid active orders at `server/src/routes/tables.ts:285-309`. |
| Payment | Critical | Single payment can underpay and mark order paid at `server/src/routes/payments.ts:167-187`; folio checkout does not close orders. |
| Reservation | Partial | Atomic status update fixed; table occupancy conflict still unchecked at `server/src/routes/reservations.ts:309-314`. |
| InventoryItem | Critical | Atomic increment/decrement added; decrement still lacks conditional stock update. |
| Vendor + PO + POItem | Critical | Route shadowing and receipt payload improved; PO create still lacks inventory tenant verification and UI create flow is missing. |
| Customer | Partial | CRUD still lacks delete/archive; email normalization should be server-enforced. |
| User | Partial | Role/status/rate paths exist; email normalization storage remains incomplete. |
| Shift + ClockEvent | Partial | Staff cannot create shifts now; shift list unpaginated and time ordering not validated. |
| Activity + ActivityBooking | Partial | Booking race fixed; staff CRUD/lifecycle still incomplete. |
| ServiceRequest | Partial | Public create and protected list/detail exist; no pagination or status update lifecycle. |
| TenantApplication | Partial | Submit/status/list/approve/reject exist; archive/delete and rollback-hardening should be added. |

## Integration Chain Results
CHAIN: POS -> KDS -> Table Details
STATUS: PARTIAL ⚠️
BROKEN AT: Step 1. Protected POS orders can still race on table occupancy; public/external orders bypass table checks entirely.

CHAIN: Table -> POS -> Checkout -> Table Map
STATUS: PARTIAL ⚠️
BROKEN AT: Step 5. Existing-order settlement no longer duplicates orders, but settlement is client-orchestrated with multiple payment calls and no rollback.

CHAIN: Reservation -> Check-In -> Table
STATUS: PARTIAL ⚠️
BROKEN AT: Step 4. Reservation status conflict is fixed, but table occupancy conflict is unchecked.

CHAIN: Inventory -> Forecast -> Vendor PO
STATUS: BROKEN ❌
BROKEN AT: Step 3/4. Vendor PO creation UI still does not exist; PO total field display is wrong.

CHAIN: Registration -> Provisioning -> Login
STATUS: PARTIAL ⚠️
BROKEN AT: No new code regression found in this rerun, but approval/provisioning rollback and email delivery/temp-password behavior still require integration tests.

## Passed Checks
- Vendor route shadowing fixed with `/orders` before `/:id`.
- PO receipt now sends `receivedQty` and pre-fills from `orderedQty`.
- PO receipt inventory lookup is tenant-scoped.
- Table batch save is tenant-scoped.
- Reservation status update is conditional and transactional.
- Activity booking decrement is conditional and transactional.
- Shift create is manager/admin only and validates target user tenant.
- Checkout hook order is valid now.
- TableDetails no longer recreates orders for table close.
- Purchase-order and guest-folio services partially handle paginated envelopes.
- Cart uses `cartLineId` for modifier variants.
- Logout action clears more state.
- Super-admin applications route has a route guard.
- Login deep-link return is implemented.
- ModifierModal uses shared Dialog and resets state.
- Dialog handles focus trap, Escape close, backdrop close, and scroll lock.
- KDS polling remains visibility-aware.

## Recommended Fix Order
1. Data integrity: replace read-then-write concurrency checks for table order creation, inventory decrement, and reservation table occupancy with conditional writes.
2. Payment correctness: create backend transactional endpoints for table settlement and folio checkout; fix underpayment handling.
3. Public flows: repair public guest check-in and validate/tenant-scope public external orders.
4. PO flow: tenant-check PO inventory items, implement PO creation UI, and fix PO total display.
5. Role policy: restrict manager from tenant/admin table/analytics routes if the stated policy is authoritative.
6. Normalize identifiers: store normalized user/vendor/customer emails.
7. Complete lifecycle APIs: ServiceRequest, ActivityBooking, Activity, Customer, and TenantApplication archive/update flows.
8. Finish UI hardening: migrate remaining modals to Dialog, complete currency/time formatting, and address mobile touch/overflow issues.

## Fix Implementation Plan
Use this section as the working checklist. Fix in order; later items depend on the payment/table semantics established in items 1-4.

### FIX-001: Make POS table locking truly atomic
- Findings: `DEEP-CRIT-001`
- Files: `server/src/routes/orders.ts`
- Change:
  - Inside `POST /api/orders`, replace the table `findFirst(... isOccupied: false)` followed by `table.update()` with a single conditional `updateMany`.
  - Run it before `order.create` inside the transaction.
- Implementation sketch:
```ts
if (tableId) {
  const locked = await tx.table.updateMany({
    where: { id: tableId, tenantId, isOccupied: false },
    data: { isOccupied: true },
  });
  if (locked.count !== 1) {
    throw conflict('Table is not available or already occupied');
  }
}
```
- Remove the later unconditional `tx.table.update({ where: { id: tableId } ... })`.
- Acceptance checks:
  - Two concurrent `POST /api/orders` requests for the same available table: exactly one returns `201`; the other returns `409`.
  - A direct order without `tableId` still succeeds.
  - Existing table order flow still appears on KDS.

### FIX-002: Make inventory reduction conditional
- Findings: `DEEP-CRIT-002`
- Files: `server/src/routes/inventory.ts`
- Change:
  - For stock reductions, replace read-check-then-decrement with conditional `updateMany`.
  - Keep audit log in the same transaction.
- Implementation sketch:
```ts
const reducing = adjustmentType === AdjustmentType.WASTE || adjustmentType === AdjustmentType.TRANSFER;

if (reducing) {
  const reduced = await tx.inventoryItem.updateMany({
    where: {
      id: itemId,
      tenantId,
      deletedAt: null,
      currentStock: { gte: quantityDecimal },
    },
    data: { currentStock: { decrement: quantityDecimal } },
  });
  if (reduced.count !== 1) {
    throw badRequest('Insufficient stock or inventory item not found');
  }
} else {
  const increased = await tx.inventoryItem.updateMany({
    where: { id: itemId, tenantId, deletedAt: null },
    data: { currentStock: { increment: quantityDecimal } },
  });
  if (increased.count !== 1) throw notFound('Inventory item not found');
}
```
- Fetch previous stock before the update only for audit context; fetch updated stock after the update for `newQty`.
- Acceptance checks:
  - Two concurrent reductions that exceed available stock: one succeeds, one fails.
  - Stock never becomes negative.
  - Audit log exists only for successful adjustments.

### FIX-003: Verify PO inventory items before create
- Findings: `DEEP-CRIT-003`
- Files: `server/src/routes/vendors.ts`
- Change:
  - After vendor tenant check and before calculating total, verify every submitted `inventoryItemId` belongs to the tenant and is not soft-deleted.
- Implementation sketch:
```ts
const inventoryIds = [...new Set(items.map((item: { inventoryItemId: string }) => item.inventoryItemId))];
const inventoryItems = await prisma.inventoryItem.findMany({
  where: { id: { in: inventoryIds }, tenantId, deletedAt: null },
  select: { id: true },
});
if (inventoryItems.length !== inventoryIds.length) {
  throw notFound('One or more inventory items were not found in this tenant');
}
```
- Acceptance checks:
  - PO create with valid tenant vendor/items returns `201`.
  - PO create with a foreign inventory item id returns `404` or `400`.
  - PO create with duplicated line items still behaves intentionally; either reject duplicates or merge them explicitly.

### FIX-004: Replace client-orchestrated table settlement with one backend transaction
- Findings: `DEEP-CRIT-004`, `DEEP-CRIT-013`, `DEEP-WARN-010`, `DEEP-WARN-011`
- Files:
  - `server/src/routes/tables.ts`
  - `server/src/validators/tables.ts` or equivalent validator file
  - `client/src/api/service.ts`
  - `client/src/pages/CheckoutPage.tsx`
- Change:
  - Add a backend endpoint, for example `POST /api/tables/:id/settle-orders`.
  - Payload: `{ orderIds: string[], method: 'CASH' | 'CARD' }`.
  - Server must validate table tenant, validate every order belongs to that table and tenant, calculate outstanding balance per order, create payments, mark orders paid, and release table in one transaction.
- Server transaction sketch:
```ts
const settled = await prisma.$transaction(async (tx) => {
  const orders = await tx.order.findMany({
    where: {
      id: { in: orderIds },
      tenantId,
      tableId: tableId,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PAID] },
    },
    include: { payments: { where: { status: PaymentStatus.COMPLETED } } },
  });
  if (orders.length !== new Set(orderIds).size) throw badRequest('Invalid order selection');

  for (const order of orders) {
    const paid = order.payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    const outstanding = order.totalAmount.minus(paid).toDecimalPlaces(2);
    if (outstanding.lte(0)) continue;
    await tx.payment.create({
      data: { tenantId, orderId: order.id, amount: outstanding, method, status: PaymentStatus.COMPLETED },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });
  }

  const unpaidCount = await tx.order.count({
    where: { tableId, tenantId, status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELLED] } },
  });
  if (unpaidCount === 0) {
    await tx.table.updateMany({ where: { id: tableId, tenantId }, data: { isOccupied: false } });
  }
  return { settledOrders: orders.length };
});
```
- Client change:
  - Replace the loop in `CheckoutPage.tsx:119-126` with one call to `tableService.settleOrders(tableId, { orderIds, method })`.
  - Stop calling `tableService.settle(tableId)` directly from payment success.
- Acceptance checks:
  - Multi-order table checkout creates one payment per order using each order's true outstanding total.
  - If any order id is invalid/foreign/already cancelled, no payments are created.
  - Table is released only when no unpaid active orders remain.

### FIX-005: Repair public guest check-in
- Findings: `DEEP-CRIT-005`
- Files:
  - `server/src/routes/reservations.ts`
  - `client/src/api/service.ts`
  - `client/src/pages/reception/CheckInPage.tsx`
- Choose one product behavior:
  - Option A: public self-check-in is allowed.
  - Option B: public check-in submits a request and staff completes the check-in.
- Option A server change:
  - Add `publicReservationRouter.post('/:id/checkin', ...)`.
  - Use `extractTenant`, the same atomic reservation status update, and conditional table occupancy update.
  - Do not expose sensitive reservation fields in the response.
- Option B client change:
  - Remove `guestService.checkIn()` call and create a `ServiceRequest` or `TenantApplication`-style pending check-in request.
- Acceptance checks:
  - `/checkin` lookup + confirm succeeds end-to-end.
  - Repeating check-in returns a clear conflict message.
  - Cancelled reservation cannot be checked in.

### FIX-006: Validate and tenant-scope public external orders
- Findings: `DEEP-CRIT-006`
- Files:
  - `server/src/routes/orders.ts`
  - `server/src/validators/order.ts`
- Change:
  - Apply Zod validation to `/external`.
  - Verify `tenantId` header is present and valid.
  - Verify `tableId` belongs to that tenant.
  - Decide whether external orders should require an occupied room/table or create an order without changing occupancy.
- Implementation requirements:
  - Reject malformed `items`.
  - Reject empty item arrays.
  - Reject foreign `tableId`.
  - Use server-side menu prices, which is already done.
- Acceptance checks:
  - Missing tenant header returns `400`.
  - Invalid body returns `400`.
  - Foreign table id returns `404`.
  - Valid room-service order returns `201`.

### FIX-007: Make folio checkout close orders transactionally
- Findings: `DEEP-CRIT-007`
- Files: `server/src/routes/payments.ts`
- Change:
  - In `/api/payments/folio`, after creating payments, update each charged order to `PAID` only when fully paid.
  - Release room/table when no unpaid orders remain for that room.
- Acceptance checks:
  - Folio checkout updates order statuses to `PAID`.
  - Partial folio payment does not mark an order paid.
  - A failed folio checkout creates no partial payments.

### FIX-008: Enforce payment outstanding balance
- Findings: `DEEP-CRIT-015`
- Files: `server/src/routes/payments.ts`
- Change:
  - Before marking an order paid, calculate completed payments already made for the order.
  - New payment must not exceed outstanding balance.
  - Mark `PAID` only if cumulative paid amount equals or exceeds `totalAmount`.
- Implementation sketch:
```ts
const paid = await tx.payment.aggregate({
  where: { orderId, tenantId, status: PaymentStatus.COMPLETED },
  _sum: { amount: true },
});
const alreadyPaid = paid._sum.amount ?? new Prisma.Decimal(0);
const paymentAmount = new Prisma.Decimal(amount).toDecimalPlaces(2);
const outstanding = order.totalAmount.minus(alreadyPaid).toDecimalPlaces(2);

if (paymentAmount.gt(outstanding)) throw badRequest('Payment amount exceeds outstanding balance');

const nextPaid = alreadyPaid.plus(paymentAmount);
if (nextPaid.gte(order.totalAmount)) {
  await tx.order.updateMany({ where: { id: orderId, tenantId }, data: { status: OrderStatus.PAID } });
}
```
- Acceptance checks:
  - Underpayment creates a payment but leaves order unpaid or partially paid according to product policy.
  - Exact payment marks order paid.
  - Overpayment returns `400`.

### FIX-009: Restrict manager admin routes if policy is authoritative
- Findings: `DEEP-CRIT-008`
- Files:
  - `client/src/App.tsx`
  - `client/src/components/layout/Shell.tsx`
  - server route guards for tenant/admin/table/analytics endpoints if present
- Change:
  - Change `/admin/tenant`, `/admin/tables`, `/admin/analytics` route guard to `[Role.TENANT_ADMIN]`.
  - Remove those nav items for managers in `Shell.tsx`.
  - Verify backend routes also reject manager if they mutate tenant-wide configuration.
- Acceptance checks:
  - Manager direct navigation to those URLs redirects to `/dashboard`.
  - Tenant admin retains access.

### FIX-010: Fix reservation status constants in guest folio
- Findings: `DEEP-CRIT-009`
- Files: `client/src/api/service.ts`
- Change:
  - Replace `status: 'checked-in'` with `status: 'SEATED'`.
  - Prefer importing `ReservationStatus` from shared types if available.
- Acceptance checks:
  - Checked-in/seated reservations appear in Guest Folio.
  - Cancelled and pending reservations do not appear when filtering seated guests.

### FIX-011: Normalize user email before storage
- Findings: `DEEP-CRIT-010`
- Files: `server/src/routes/users.ts`
- Change:
```ts
const normalizedEmail = email.trim().toLowerCase();
const existing = await prisma.user.findFirst({
  where: { email: normalizedEmail, tenantId },
});
...
email: normalizedEmail,
```
- Acceptance checks:
  - Creating `Test@Example.com` stores `test@example.com`.
  - Creating ` test@example.com ` after that returns duplicate error.

### FIX-012: Complete purchase order creation UI
- Findings: `DEEP-CRIT-011`
- Files:
  - `client/src/pages/vendors/VendorPage.tsx`
  - `client/src/api/service.ts`
  - optionally `client/src/components/vendors/PurchaseOrderModal.tsx`
- Change:
  - Add modal/drawer opened by `New Order` on the Purchase Orders tab.
  - Required fields: vendor, one or more line items, inventory item, ordered quantity, unit cost.
  - Validate no zero line items, positive quantities, positive unit costs.
  - On success invalidate `['purchase-orders']`.
- Acceptance checks:
  - New PO can be created from UI.
  - Submit disabled with zero line items.
  - Created PO appears in list without refresh.

### FIX-013: Correct purchase order total display
- Findings: `DEEP-CRIT-012`
- Files: `client/src/pages/vendors/VendorPage.tsx`
- Change:
  - Replace `po.totalAmount` with `po.totalCost`.
  - Use `formatCurrency(po.totalCost, currency)`.
- Acceptance checks:
  - PO list displays non-zero total matching server response.

### FIX-014: Protect reservation table occupancy
- Findings: `DEEP-CRIT-014`
- Files: `server/src/routes/reservations.ts`
- Change:
  - After reservation status update, replace unconditional `tx.table.update` with conditional `updateMany({ id, tenantId, isOccupied: false })`.
  - If count is zero, throw conflict and ensure reservation status is not committed. This means both status update and table update must be in the same transaction, which they already are.
- Acceptance checks:
  - Check-in fails if assigned table is occupied.
  - Failed check-in does not leave reservation as `SEATED`.

## Warning Fix Backlog
These can be handled after criticals unless they block the same file being edited.

| Priority | Finding | Files | Fix |
|---:|---|---|---|
| 1 | `DEEP-WARN-001` | `client/src/pages/vendors/VendorPage.tsx` | Disable PO receipt confirm until every quantity is finite, non-negative, and not blank. |
| 1 | `DEEP-WARN-020` | `server/src/routes/shifts.ts`, `client/src/pages/admin/WorkforcePage.tsx` | Add server Zod refinement and client validation for `endTime > startTime`. |
| 2 | `DEEP-WARN-002` | Vendor schema/routes/UI | Either add `address` to schema/Prisma/validators or remove it from the form. |
| 2 | `DEEP-WARN-003` | `server/src/routes/shifts.ts` | Add `page`, `limit`, `skip`, `take`, and max date span. |
| 2 | `DEEP-WARN-004` | `server/src/routes/requests.ts` | Add paginated list and `PATCH /api/requests/:id` for status/assignee. |
| 2 | `DEEP-WARN-005` | `server/src/routes/activities.ts`, `server/src/routes/activity-bookings.ts` | Add archive/cancel/list/update endpoints for activity bookings. |
| 3 | `DEEP-WARN-006` | Page modals | Migrate remaining custom overlays to `Dialog`. |
| 3 | `DEEP-WARN-007` | `client/src/components/ui/Dialog.tsx` | Restore focus to trigger on close. |
| 3 | `DEEP-WARN-008`, `DEEP-WARN-009`, `DEEP-WARN-018` | Client display pages | Replace hardcoded KES/USD/export labels with `formatCurrency` and tenant currency. |
| 3 | `DEEP-WARN-014` | `client/src/pages/DashboardPage.tsx` | Make polling visibility-aware. |
| 4 | `DEEP-WARN-015`, `DEEP-WARN-016` | Mobile UI pages | Increase touch targets and gate/fix floor-plan editor on mobile. |
| 4 | `DEEP-WARN-017` | `client/src/App.tsx` | Add route-level guard to `/menu`. |
| 4 | `DEEP-WARN-019` | `client/src/pages/vendors/VendorPage.tsx` | Remove `any` cast and consume typed `purchaseOrders.data`. |

## Minimum Regression Test Plan
Add these before considering the audit closed.

1. `server`: concurrent table order creation test.
   - Arrange one available table and two authenticated requests.
   - Assert one `201`, one `409`, one order row, table occupied.

2. `server`: concurrent inventory decrement test.
   - Arrange stock `5`.
   - Fire two `WASTE` adjustments of `4`.
   - Assert one success, one failure, final stock `1`.

3. `server`: table settlement transaction test.
   - Arrange table with two unpaid orders.
   - Call new settlement endpoint.
   - Assert two payments, both orders paid, table available.
   - Force one invalid order id and assert no payments are created.

4. `server`: payment underpayment test.
   - Arrange order total `100`.
   - Pay `50`.
   - Assert order is not `PAID`.
   - Pay remaining `50`.
   - Assert order is `PAID`.

5. `server`: PO create tenant isolation test.
   - Submit current tenant vendor with another tenant's inventory item.
   - Assert rejection and no PO/POItem rows.

6. `client`: public check-in integration test.
   - Lookup reservation, confirm check-in, assert success screen.
   - Repeat check-in, assert conflict message.

7. `client`: Vendor PO creation test.
   - Open Purchase Orders tab, click New Order, add line, submit.
   - Assert modal closes and new PO appears.

8. `client`: route permission test.
   - Login as Manager.
   - Directly visit `/admin/tenant`, `/admin/tables`, `/admin/analytics`.
   - Assert redirect to `/dashboard` if policy remains tenant-admin only.
