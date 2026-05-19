# Mumo POS — Deep CRUD & Interaction Audit
Date: 2026-05-19
Auditor: OpenAI Codex

## Summary
| Phase | Findings | Critical | Warning | Pass |
|---|---:|---:|---:|---:|
| CRUD Operations | 23 | 8 | 15 | 9 |
| Modals & Forms | 17 | 3 | 14 | 5 |
| State Management | 5 | 2 | 3 | 3 |
| Error Handling | 6 | 1 | 5 | 2 |
| Navigation & Routing | 7 | 1 | 6 | 3 |
| Data Display | 6 | 0 | 6 | 2 |
| Integration Points | 11 | 5 | 6 | 3 |
| Mobile | 6 | 0 | 6 | 4 |
| Concurrent Users | 4 | 4 | 0 | 1 |
| TOTAL | 85 | 24 | 61 | 32 |

## Critical Findings
### DEEP-CRIT-001: Purchase order routes are shadowed by `/:id`
- Phase: CRUD Operations / Integration Points
- Location: `server/src/routes/vendors.ts:53`, `server/src/routes/vendors.ts:147`
- Issue: `router.get('/:id')` is registered before `router.get('/orders')`, so `GET /api/vendors/orders` is handled as vendor id `orders`.
- Evidence: `router.get('/:id'...)` appears at line 53 and `router.get('/orders'...)` only appears at line 147.
- Risk: Purchase order list is unreachable. Vendor PO screen cannot load orders reliably.
- Fix: Move every `/orders...` route above `/:id`, or mount purchase orders under a separate router such as `/api/purchase-orders`.

### DEEP-CRIT-002: PO receiving payload does not match server contract
- Phase: CRUD Operations / Modals & Forms
- Location: `client/src/pages/vendors/VendorPage.tsx:52`, `client/src/pages/vendors/VendorPage.tsx:70`, `server/src/routes/vendors.ts:265`
- Issue: Client sends `qtyReceived`, initializes quantities from `item.quantity`, and displays `item.quantity`, but server expects `receipt.receivedQty` and PO items are serialized as `orderedQty`.
- Evidence: `qtyReceived: receivedQtys[item.id] || 0` at `VendorPage.tsx:56`; `qtys[item.id] = item.quantity` at `VendorPage.tsx:74`; server reads `receipt.receivedQty` at `vendors.ts:271`.
- Risk: Confirm receipt can write `Decimal(undefined)` or record zero/undefined quantities; inventory increments and audit logs become wrong or the request fails.
- Fix: Use one shape end-to-end: `{ inventoryItemId, receivedQty }`, prefill from `orderedQty`, display `orderedQty`, and validate all received quantities before submit.

### DEEP-CRIT-003: PO create and receive do not verify tenant ownership of related records
- Phase: Security / CRUD Operations
- Location: `server/src/routes/vendors.ts:203`, `server/src/routes/vendors.ts:291`
- Issue: PO creation accepts `vendorId` and `inventoryItemId` from the body without verifying they belong to the authenticated tenant. Receiving later fetches inventory with `findUnique({ id })`, also without `tenantId`.
- Evidence: `vendorId` is written directly at `vendors.ts:216`; `inventoryItemId: item.inventoryItemId` at `vendors.ts:220`; receiving uses `where: { id: poItem.inventoryItemId }` at `vendors.ts:292`.
- Risk: A manager can attach a purchase order to another tenant's vendor or increment another tenant's inventory if IDs are known.
- Fix: Before create, fetch vendor and all inventory items with `{ tenantId }` and reject mismatches. During receive, use `findFirst({ where: { id, tenantId, deletedAt: null } })` and update with tenant-scoped checks.

### DEEP-CRIT-004: Floor-plan batch upsert can overwrite another tenant's table
- Phase: Security / CRUD Operations
- Location: `server/src/routes/tables.ts:160`
- Issue: Batch save uses `upsert({ where: { id: t.id } })`; an attacker who submits another tenant's table id updates that row because `tenantId` is not in the update predicate.
- Evidence: `where: { id: t.id }` at `tables.ts:163`; `update` fields follow at `tables.ts:164-171`.
- Risk: Cross-tenant table layout tampering.
- Fix: Split create/update. For existing ids, `updateMany({ where: { id, tenantId }, data })` and assert `count === 1`; create only for client-generated ids not already present.

### DEEP-CRIT-005: POS order creation does not lock or occupy tables
- Phase: Concurrent Users / Integration Points
- Location: `server/src/routes/orders.ts:214`, `server/src/routes/orders.ts:251`
- Issue: Order creation validates table existence outside a transaction, does not check `isOccupied`, and never marks the table occupied.
- Evidence: table lookup at `orders.ts:216-218`; order create at `orders.ts:251-260`; no table update in the transaction because there is no transaction.
- Risk: Two cashiers can create separate active orders against the same available table; Table Map/KDS/table details state diverges.
- Fix: Wrap table check, order create, and table occupancy update in one transaction. Use `updateMany({ where: { id, tenantId, isOccupied: false } })` or a stronger table-session model and reject conflicts.

### DEEP-CRIT-006: Inventory adjustment is read-modify-write and races
- Phase: Concurrent Users / Data Integrity
- Location: `server/src/routes/inventory.ts:261`
- Issue: The handler reads current stock, computes `newStock` in JS, then updates with the absolute value.
- Evidence: `const item = await prisma.inventoryItem.findFirst(...)` at `inventory.ts:261`; `newStock = item.currentStock.plus(...)` at `inventory.ts:277`; update writes `currentStock: newStock` at `inventory.ts:284`.
- Risk: Concurrent adjustments lose updates. Two +10 adjustments against stock 5 can both save 15 instead of 25.
- Fix: Use atomic `increment`/`decrement` where possible, or serializable transaction with conditional update and retry. Keep audit log in the same transaction.

### DEEP-CRIT-007: Reservation check-in status check is outside the transaction
- Phase: Concurrent Users / Integration Points
- Location: `server/src/routes/reservations.ts:280`
- Issue: The handler checks reservation status before the transaction and then updates unconditionally inside it.
- Evidence: pre-checks at `reservations.ts:280-289`; transaction update uses `where: { id: req.params.id }` at `reservations.ts:294-296`.
- Risk: Two staff can check in the same reservation concurrently and both receive success. Table occupancy updates are not conflict-checked either.
- Fix: Use `updateMany({ where: { id, tenantId, status: { notIn: [CANCELLED, SEATED] } } })` inside the transaction and reject `count === 0`.

### DEEP-CRIT-008: Checkout violates React Rules of Hooks
- Phase: Modals & Forms / State Management
- Location: `client/src/pages/CheckoutPage.tsx:38`
- Issue: The component returns early for an empty cart before declaring `useMutation` hooks.
- Evidence: early return starts at `CheckoutPage.tsx:38`; `useMutation` calls start at `CheckoutPage.tsx:54` and `CheckoutPage.tsx:68`.
- Risk: Hook order changes if the cart goes from empty to populated while the component remains mounted, causing React runtime errors.
- Fix: Move all hooks above conditional returns; render the empty-cart state after hook declarations.

### DEEP-CRIT-009: Closing a table recreates its active orders instead of paying them
- Phase: Integration Points / CRUD Operations
- Location: `client/src/pages/TableDetailsPage.tsx:53`, `client/src/pages/CheckoutPage.tsx:97`
- Issue: TableDetails loads active order items into the cart, then Checkout creates a new order from the cart and pays that new order.
- Evidence: `cart.addItem(...)` for active order items at `TableDetailsPage.tsx:58-66`; Checkout creates a new order at `CheckoutPage.tsx:99-102`.
- Risk: Active orders remain unpaid while a duplicate paid order is created. Revenue, KDS status, and table settlement become inaccurate.
- Fix: Checkout existing order ids directly, or add a table-close endpoint that settles all active orders in one transaction.

### DEEP-CRIT-010: Activity booking can overbook slots
- Phase: Concurrent Users / CRUD Operations
- Location: `server/src/routes/activity-bookings.ts:42`
- Issue: `availableSlots <= 0` is checked before the transaction, and the decrement update does not include `availableSlots: { gt: 0 }` or assert `slotUpdate.count`.
- Evidence: pre-check at `activity-bookings.ts:42`; `activity.updateMany({ where: { id, tenantId }, data: { availableSlots: { decrement: 1 } } })` at `activity-bookings.ts:57-60`.
- Risk: Concurrent bookings can drive slots negative.
- Fix: In the transaction, first `updateMany({ where: { id, tenantId, availableSlots: { gt: 0 } }, data: { decrement: 1 } })`, assert count, then create booking.

### DEEP-CRIT-011: Staff can create shifts for arbitrary users
- Phase: CRUD Operations / Security
- Location: `server/src/routes/shifts.ts:80`
- Issue: Shift create allows `Role.STAFF` and writes the body `userId` without verifying target user tenant membership or self/admin authorization.
- Evidence: `requireRole(... Role.STAFF)` at `shifts.ts:80`; `userId: data.userId` at `shifts.ts:88`.
- Risk: A staff user can schedule shifts for another user id if they can call the API.
- Fix: Restrict shift CRUD to tenant admin/manager, or allow staff only for self-service clocking. Validate `userId` with `{ id, tenantId }`.

### DEEP-CRIT-012: Guest folio and purchase-order client types no longer match server envelopes
- Phase: API/Error Handling / Integration Points
- Location: `client/src/api/service.ts:269`, `client/src/api/service.ts:335`, `client/src/pages/vendors/VendorPage.tsx:217`
- Issue: Server list endpoints return paginated envelopes, but client functions still type and consume arrays.
- Evidence: `purchaseOrderService.getAll` expects `PurchaseOrder[]` at `service.ts:270`; folio calls expect `Order[]` and `Payment[]` at `service.ts:338-341`; VendorPage calls `purchaseOrders?.map` at `VendorPage.tsx:217`.
- Risk: Runtime crashes (`map is not a function`) or empty folios in production.
- Fix: Update services and pages to consume `{ data, total, page, limit, totalPages }`, or add explicit unpaginated endpoints where appropriate.

## Warnings
### DEEP-WARN-001: Customer, Activity, ActivityBooking, ServiceRequest, and TenantApplication do not have full CRUD
- Phase: CRUD Operations
- Location: `server/src/routes/customers.ts`, `server/src/routes/activities.ts`, `server/src/routes/activity-bookings.ts`, `server/src/routes/requests.ts`, `server/src/routes/onboarding.ts`
- Issue: Customer has create/read/update but no delete. Activity has create/read/update but no delete. ActivityBooking has public create but no staff read/update/delete. ServiceRequest has create/list/status read but no assignment/status update/delete. TenantApplication has submit/list/approve/reject but no delete/archive endpoint.
- Fix: Define intended lifecycle per model. Add soft delete/archive for auditable records and expose staff-admin endpoints where the UI requires them.

### DEEP-WARN-002: Several list endpoints remain unpaginated
- Phase: CRUD Operations / Performance
- Location: `server/src/routes/activities.ts`, `server/src/routes/requests.ts`, `server/src/routes/shifts.ts`, `server/src/routes/clock-events.ts`
- Issue: List reads for activities, service requests, shifts, and clock events return all matching rows.
- Fix: Add `page`, `limit`, `skip`, `take`, and total counts consistently.

### DEEP-WARN-003: Duplicate checks rely on database errors
- Phase: CRUD Operations
- Location: `server/src/routes/menus.ts`, `server/src/routes/inventory.ts`, `server/src/routes/vendors.ts`, `server/src/routes/customers.ts`
- Issue: Unique constraints exist for some fields, but create handlers do not consistently pre-check duplicates and return domain-specific messages.
- Fix: Pre-check normalized business keys (`name`, `sku`, `email`, vendor name as needed) and map Prisma `P2002` to clean 409 responses.

### DEEP-WARN-004: User emails are checked normalized but stored raw
- Phase: CRUD Operations / Data Integrity
- Location: `server/src/routes/users.ts:80`
- Issue: The route checks duplicates using lowercase/trimmed email but writes the submitted email value.
- Fix: Store `email.trim().toLowerCase()` and use the same normalization for login and updates.

### DEEP-WARN-005: Menu manager uses float parsing for prices
- Phase: Modals & Forms / Data Display
- Location: `client/src/pages/MenuManagerPage.tsx:284`
- Issue: Price input is hardcoded to KES and parses with `parseFloat`.
- Evidence: label `Price (KES)` at line 284; `parseFloat(e.target.value)` at line 288.
- Fix: Use a decimal-safe money input string, validate cents precision, and display tenant currency.

### DEEP-WARN-006: Inventory adjustment modal does not require reason
- Phase: Modals & Forms
- Location: `client/src/pages/inventory/InventoryPage.tsx:681`
- Issue: Reason textarea is optional; submit only rejects zero quantity.
- Evidence: zero check at `InventoryPage.tsx:631`; no reason validation before `mutation.mutate(form)` at line 635.
- Fix: Require a non-empty reason for auditable stock changes.

### DEEP-WARN-007: Inventory adjustment type names do not match server enum
- Phase: Modals & Forms / CRUD Operations
- Location: `client/src/pages/inventory/InventoryPage.tsx:653`, `server/src/routes/inventory.ts:259`
- Issue: Client sends `type`, with values like `PURCHASE` and `WASTAGE`; server reads `adjustmentType` and compares with enum values including `WASTE`.
- Fix: Align payload field and enum names. Prefer a shared TypeScript type from `/types`.

### DEEP-WARN-008: Reservation modal allows invalid operational states
- Phase: Modals & Forms
- Location: `client/src/components/reservations/ReservationModal.tsx`
- Issue: Date input has no minimum date, party size has no maximum limit, no table dropdown is present, and submitted phone/status fields do not match the current server create behavior.
- Fix: Enforce `min=today`, max party size, available-table selection, and map fields to `guestPhone`, `startTime`, `endTime`, and server-supported status.

### DEEP-WARN-009: Modifier modal state can leak between menu items
- Phase: Modals & Forms / State Management
- Location: `client/src/components/pos/ModifierModal.tsx:21`
- Issue: `selected` modifier state is initialized once and not reset when a different item opens.
- Fix: Reset selected modifiers in an effect keyed by `isOpen` and `item?.id`.

### DEEP-WARN-010: Requested SplitBillModal does not exist
- Phase: Modals & Forms
- Location: `client/src/components`
- Issue: No `SplitBillModal.tsx` file exists, so split tender validation, midway failure handling, and independent cash/card save behavior cannot work.
- Fix: Implement split-bill UI and a backend transactional split-payment endpoint, or remove split-bill affordances from scope.

### DEEP-WARN-011: Note drawer is order-local and not persisted
- Phase: Modals & Forms / Integration Points
- Location: `client/src/components/pos/NoteDrawer.tsx`, `client/src/pages/POSPage.tsx`
- Issue: The drawer edits an order note in client state, not the correct cart item, and order creation does not send notes to the server.
- Fix: Add `notes` to cart item/order payload as intended, enforce the 200-character limit, and persist it in `OrderItem` or `Order`.

### DEEP-WARN-012: Modal accessibility is incomplete across the app
- Phase: Modals & Forms / Mobile
- Location: `client/src/pages/MenuManagerPage.tsx:201`, `client/src/pages/inventory/InventoryPage.tsx:441`, `client/src/pages/admin/WorkforcePage.tsx:365`, `client/src/pages/vendors/VendorPage.tsx`
- Issue: Modals generally do not trap focus, return focus to the trigger, close on Escape, or prevent background scroll. Several overlays also do not close on backdrop click.
- Fix: Centralize a `Dialog` component with focus trap, Escape/backdrop handling, `aria-modal`, and body scroll lock.

### DEEP-WARN-013: Cart variant handling is inconsistent
- Phase: State Management / POS
- Location: `client/src/store/useStore.ts:130`
- Issue: Duplicate detection checks `menuItemId` and `name`, but `updateQuantity`/`removeItem` operate by `menuItemId` only. Modifier variants of the same item can be updated or removed together.
- Fix: Give each cart line a stable `cartLineId` including modifier selections and update/remove by that id.

### DEEP-WARN-014: Logout clears session but leaves cart and UI state
- Phase: State Management / Navigation
- Location: `client/src/components/layout/Shell.tsx:63`
- Issue: Logout calls `clearSession()` only. Cart, guest tenant, and UI state remain in Zustand.
- Fix: Add a single `logout()` store action that clears session, super-admin session, cart, guest context, and transient UI.

### DEEP-WARN-015: Refresh failure clears token but does not navigate
- Phase: Error Handling
- Location: `client/src/api/service.ts:164`
- Issue: Failed refresh sets session token to null and rejects, but does not redirect or broadcast logout.
- Fix: Dispatch a logout event or central router redirect to `/login` with the original location preserved.

### DEEP-WARN-016: Login ignores intended deep-link return path
- Phase: Navigation & Routing
- Location: `client/src/routes/ProtectedRoute.tsx:34`, `client/src/pages/LoginPage.tsx:63`
- Issue: ProtectedRoute stores `state.from`, but LoginPage always navigates to `/dashboard`.
- Fix: Read `useLocation().state?.from?.pathname` and navigate there after successful login.

### DEEP-WARN-017: Route guards do not match stated role policy
- Phase: Navigation & Routing
- Location: `client/src/App.tsx:86`, `client/src/App.tsx:91`, `client/src/App.tsx:94`, `client/src/App.tsx:110`
- Issue: `/guests` is allowed for STAFF, `/reports` has no role guard, and managers are allowed into `/admin/permissions`, `/admin/tenant`, `/admin/tables`, and `/admin/analytics`.
- Fix: Encode role policy in one table and use it for both routes and nav. Restrict manager from the specified admin routes and restrict staff/cashier from reports and guest directory.

### DEEP-WARN-018: Super-admin applications route is public in the router
- Phase: Navigation & Routing / Security
- Location: `client/src/App.tsx:62`
- Issue: `/super-admin/applications` is mounted outside `ProtectedRoute`.
- Fix: Add a super-admin route guard at the router level; page-level checks are not enough for consistent navigation behavior.

### DEEP-WARN-019: KDS role guard is commented out
- Phase: Navigation & Routing
- Location: `client/src/pages/KDSPage.tsx:33`
- Issue: The code discusses blocking cashier/staff, but the actual redirect is commented out at lines 86-89.
- Fix: Replace comments with a concrete role/permission check.

### DEEP-WARN-020: Currency is hardcoded in many operational pages
- Phase: Data Display
- Location: `client/src/pages/CheckoutPage.tsx:164`, `client/src/pages/MenuManagerPage.tsx:138`, `client/src/pages/admin/WorkforcePage.tsx:172`, `client/src/pages/GuestFolioPage.tsx:189`
- Issue: POS uses tenant currency in places, but Checkout/Menu/Workforce/Reports/Folio/Inventory hardcode KES or `$`.
- Fix: Create `formatCurrency(amount, tenantSettings.currency, locale)` and use it everywhere.

### DEEP-WARN-021: Date/time formatting uses browser timezone
- Phase: Data Display
- Location: `client/src/pages/admin/WorkforcePage.tsx:346`, `client/src/pages/inventory/InventoryPage.tsx:411`, `client/src/pages/ReportsPage.tsx:174`
- Issue: Components format dates with `new Date()`/`date-fns` in browser local timezone, not tenant timezone.
- Fix: Store and use `TenantSettings.timezone` via a date formatting utility.

### DEEP-WARN-022: Small text is used for critical values
- Phase: Mobile
- Location: `client/src/pages/admin/WorkforcePage.tsx:240`, `client/src/components/layout/Shell.tsx:188`, `client/src/pages/inventory/InventoryPage.tsx:281`
- Issue: `rg` found 107 instances of `text-xs`, `text-[10px]`, or `text-[11px]`. Some are statuses, station labels, and nav labels.
- Fix: Review critical operational labels and keep them at 12px+ with sufficient contrast.

### DEEP-WARN-023: Fixed widths and large editor canvas can overflow mobile
- Phase: Mobile
- Location: `client/src/pages/admin/TableManagementPage.tsx:221`, `client/src/pages/MenuManagerPage.tsx:72`
- Issue: Floor planner renders a 20x20 grid at 40px cells plus 100px padding; Menu search uses `w-[300px]`.
- Fix: Make editor explicitly desktop-only or provide a mobile-safe layout. Replace fixed search width with responsive `w-full tablet:w-[300px]`.

### DEEP-WARN-024: Mobile touch targets below 44px
- Phase: Mobile
- Location: `client/src/components/layout/Shell.tsx:167`, `client/src/pages/POSPage.tsx:321`, `client/src/pages/admin/TableManagementPage.tsx:278`
- Issue: Several controls use `h-8 w-8`, `p-2`, or `h-10`, below the 44x44px touch target guideline.
- Fix: Increase interactive controls to at least `h-11 w-11` on mobile.

### DEEP-WARN-025: Dashboard polling ignores hidden-tab visibility
- Phase: Performance / Mobile
- Location: `client/src/pages/DashboardPage.tsx:42`
- Issue: Dashboard refetches every 15 seconds without a visibility-aware pause.
- Fix: Use `refetchInterval: () => document.visibilityState === 'visible' ? 15000 : false` and `refetchIntervalInBackground: false`.

## CRUD Operation Matrix
| Model | Result | Evidence |
|---|---|---|
| MenuItem | Partial | Server injects tenant and recalculates order prices, but client parses price with `parseFloat` and hardcodes KES at `client/src/pages/MenuManagerPage.tsx:284-288`; no duplicate pre-check before create. |
| Order + OrderItem | Critical | Create uses tenantId and Decimal server-side, but table occupancy/race handling is missing at `server/src/routes/orders.ts:214-260`. |
| Table | Critical | List/create/update exist, but batch update is cross-tenant unsafe at `server/src/routes/tables.ts:160-183`; delete is hard delete and can fail with historical records. |
| Payment | Partial | Single payment settlement is transactional, but folio checkout creates payments without settling related orders/table state in `server/src/routes/payments.ts:81-107`. |
| Reservation | Partial | CRUD exists with soft cancel; check-in race exists at `server/src/routes/reservations.ts:280-308`; create modal lacks table availability filtering. |
| InventoryItem | Critical | Soft delete exists, but adjustment races at `server/src/routes/inventory.ts:261-284`; client/server adjustment payload mismatch. |
| Vendor + PO + POItem | Critical | Vendor CRUD exists; PO list route shadowed, PO create lacks related-record tenant checks, PO receive payload mismatch. |
| Customer | Partial | Create/read/update exist; no delete/archive endpoint; duplicate handling relies on database unique behavior. |
| User | Partial | Create/list/role/status/rate exist; email normalization storage gap; no full delete, which is acceptable if status is the intended soft delete. |
| Shift + ClockEvent | Critical | Shift create is over-permissive at `server/src/routes/shifts.ts:80`; no end-after-start validation in client at `client/src/pages/admin/WorkforcePage.tsx:97-115`; clock events lack sequence validation. |
| Activity + ActivityBooking | Critical | Booking overbook race at `server/src/routes/activity-bookings.ts:42-60`; Activity lacks delete; Booking lacks staff CRUD. |
| ServiceRequest | Partial | Public create and list exist, but no protected status transition/assignment endpoint; list is unpaginated. |
| TenantApplication | Partial | Submit/list/approve/reject exist; approval/provisioning needs one transaction boundary or compensating rollback; no archive/delete endpoint. |

## Integration Chain Results
CHAIN: POS -> KDS -> Table Details
STATUS: PARTIAL ⚠️
BROKEN AT: Step 1/4. POS creates orders and KDS can poll them, but order creation does not occupy the table (`server/src/routes/orders.ts:251`), and TableDetails closing duplicates orders instead of settling existing ones (`client/src/pages/TableDetailsPage.tsx:53`).

CHAIN: Table -> POS -> Checkout -> Table Map
STATUS: BROKEN ❌
BROKEN AT: Step 4 and 5. The table is not marked occupied on order creation. Checkout calls `tableService.settle(tableId)` without awaiting or handling failure at `client/src/pages/CheckoutPage.tsx:75`.

CHAIN: Reservation -> Check-In -> Table
STATUS: PARTIAL ⚠️
BROKEN AT: Step 3. Check-in marks the table occupied, but the status conflict check is outside the transaction (`server/src/routes/reservations.ts:280-308`), and the modal does not ensure an available table selection.

CHAIN: Inventory -> Forecast -> Vendor PO
STATUS: BROKEN ❌
BROKEN AT: Step 3/4. Inventory “Order Refill” navigates only to `/vendors` (`client/src/pages/inventory/InventoryPage.tsx:435`), not `/vendors/orders/new`; VendorPage has no PO line-item creation form and PO list is route-shadowed.

CHAIN: Registration -> Provisioning -> Login
STATUS: PARTIAL ⚠️
BROKEN AT: UAT completeness. Tenant provisioning creates tenant/settings/admin/tables in service, but approval status should not be committed separately from provisioning failure handling. Verify welcome email/temp-password flow in deployed environment.

## Passed Checks
- Menu/order price tampering protection passes: order create fetches current menu prices by tenant and uses server-side Decimal math at `server/src/routes/orders.ts:222-249`.
- Order totals are rounded before save: line item subtotals and total use `.toDecimalPlaces(2)` at `server/src/routes/orders.ts:237` and `server/src/routes/orders.ts:249`.
- Inventory delete is soft delete: route sets `deletedAt` instead of hard deleting in `server/src/routes/inventory.ts:223-243`.
- Reservation delete is soft cancel: route sets status to cancelled rather than removing history.
- User deactivation revokes refresh tokens in the status route transaction.
- KDS polling is visibility-aware: `refetchInterval` returns `false` when hidden and `refetchIntervalInBackground` is false at `client/src/pages/KDSPage.tsx:69-74`.
- Offline-order retry clears interval on unmount and skips hidden tabs at `client/src/hooks/useOfflineOrders.ts:112-128`.
- Shell mobile bottom nav is hidden on desktop via `tablet:hidden` and content has `pb-20` at `client/src/components/layout/Shell.tsx:176-203`.
- ProtectedRoute attempts silent session restore from httpOnly refresh cookie on reload at `client/src/routes/ProtectedRoute.tsx:17-22`.

## Recommended Fix Order
1. Security: fix cross-tenant writes in table batch, PO create/receive, and shift create.
2. Data loss/races: transactionally lock table order creation, inventory adjustment, reservation check-in, and activity booking slot decrement.
3. Broken integrations: repair vendor PO route ordering and client payload/envelope mismatches; replace table-close cart duplication with existing-order settlement.
4. Runtime stability: move Checkout hooks above early returns and update paginated service consumers.
5. Role controls: centralize route/nav permission policy and protect super-admin applications route.
6. Form contracts: align inventory adjustment, reservation, PO receipt, note, and menu price fields with server schemas.
7. UX/accessibility: centralize modal/dialog behavior with focus trap, Escape/backdrop close, scroll lock, and reset-on-open.
8. Display/mobile: implement tenant-aware currency/time formatting and review small touch targets/fixed widths.
9. Tests: add concurrency tests for table/order, inventory adjust, reservation check-in, activity booking, and integration tests for PO receiving and table settlement.
