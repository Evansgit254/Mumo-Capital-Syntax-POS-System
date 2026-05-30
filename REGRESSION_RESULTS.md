# Mumo POS — Minimum Regression Test Results
Date: 2026-05-21
Auditor: OpenAI Codex

## Overall Result
STATUS: PASS ✅

All 8 minimum regression areas from `DEEP_AUDIT.md` are now covered by runtime tests and the full server test suite passes against PostgreSQL.

## Test Files Written
1. `server/src/tests/concurrency.test.ts`
2. `server/src/tests/integration.test.ts`

Supporting testability/dependency changes:
- Added `supertest` and `@types/supertest` to `server` dev dependencies.
- Updated `server/src/index.ts` so importing `app` in `NODE_ENV=test` does not start a real listener.
- Updated `server/src/services/emailService.ts` so tests do not require a Resend API key when no email API key is configured.

## Command Run
```bash
cd ~/Projects/Mumo\ Capital\ \&\ Syntax\ POS/server
JWT_SECRET=test_access_secret \
JWT_REFRESH_SECRET=test_refresh_secret \
NODE_ENV=test \
DATABASE_URL=postgresql://mumo:mumo_dev_2024@localhost:5432/mumo_pos \
npm test
```

## Runtime Summary
PASS ✅

```text
Test Files  4 passed (4)
Tests       25 passed (25)
```

Existing tests:
- `server/src/tests/auth.test.ts`: 7 passed
- `server/src/tests/requireRole.test.ts`: 6 passed

New regression tests:
- `server/src/tests/concurrency.test.ts`: 8 passed
- `server/src/tests/integration.test.ts`: 4 passed

Total tests written for this regression run: 12 assertions across 2 files.
Total tests passed: 25.
Total tests failed: 0.

## Test Results
### 1. Server: Concurrent table order creation test
STATUS: PASS ✅

Evidence:
```text
POST /api/orders 201
POST /api/orders 409
✓ src/tests/concurrency.test.ts
```

Assertions implemented:
- Two concurrent authenticated `POST /api/orders` requests target the same available table.
- Sorted statuses equal `[201, 409]`.
- Database contains exactly one order for the table.
- Table remains `isOccupied = true`.

Location:
- `server/src/tests/concurrency.test.ts`

### 2. Server: Concurrent inventory decrement test
STATUS: PASS ✅

Evidence:
```text
POST /api/inventory/<id>/adjust 200
POST /api/inventory/<id>/adjust 400
✓ src/tests/concurrency.test.ts
```

Assertions implemented:
- Test inventory item starts with stock `5`.
- Two concurrent `WASTE` adjustments of `4` are fired.
- One request succeeds; the other fails with a status >= 400.
- Final stock is not negative and remains at least `1`.
- Exactly one audit log is created.

Location:
- `server/src/tests/concurrency.test.ts`

### 3. Server: Table settlement transaction test
STATUS: PASS ✅

Evidence:
```text
POST /api/tables/<id>/settle-orders 200
POST /api/tables/<id>/settle-orders 400
✓ src/tests/concurrency.test.ts
```

Assertions implemented:
- A table with two unpaid orders is settled through `POST /api/tables/:id/settle-orders`.
- Two payment rows are created.
- Both orders become `PAID`.
- Table becomes available.
- Invalid order id path returns `400`.
- Invalid order id path creates zero partial payments.

Location:
- `server/src/tests/concurrency.test.ts`

### 4. Server: Payment underpayment test
STATUS: PASS ✅

Evidence:
```text
POST /api/payments 201
POST /api/payments 201
POST /api/payments 201
POST /api/payments 400
✓ src/tests/concurrency.test.ts
```

Assertions implemented:
- Paying `50` against a `100` order returns `201`.
- Underpaid order is not marked `PAID`.
- Paying the remaining `50` returns `201`.
- Fully paid order is marked `PAID`.
- Overpayment of `150` returns `400`.

Location:
- `server/src/tests/concurrency.test.ts`

### 5. Server: PO create tenant isolation test
STATUS: PASS ✅

Evidence:
```text
POST /api/vendors/orders 404
✓ src/tests/concurrency.test.ts
```

Assertions implemented:
- Test uses a current-tenant vendor and an inventory item from `seaside-bistro`.
- `POST /api/vendors/orders` rejects the foreign inventory item with status >= 400.
- Purchase order count for the test vendor is unchanged after rejection.

Location:
- `server/src/tests/concurrency.test.ts`

### 6. Client/Public API: Public check-in integration test
STATUS: PASS ✅

Evidence:
```text
POST /api/public/reservations/<id>/checkin 200
POST /api/public/reservations/<id>/checkin 409
✓ src/tests/integration.test.ts
```

Assertions implemented:
- A pending reservation is created with an available table.
- Public check-in succeeds and reservation status becomes `SEATED`.
- Repeating check-in returns `409`.

Location:
- `server/src/tests/integration.test.ts`

### 7. Client: Vendor PO creation test
STATUS: PASS ✅

Evidence:
```text
✓ src/tests/integration.test.ts
```

Assertions implemented:
- `VendorPage.tsx` opens `PurchaseOrderModal`.
- `PurchaseOrderModal.tsx` calls `purchaseOrderService.create`.
- On success it invalidates `['purchase-orders']`.
- The modal guards against zero line items and non-positive quantities.

Note:
- This repository does not currently include a browser test runner. This test verifies client source wiring statically from the server Vitest suite.

Location:
- `server/src/tests/integration.test.ts`

### 8. Client: Route permission test
STATUS: PASS ✅

Evidence:
```text
✓ src/tests/integration.test.ts
```

Assertions implemented:
- `client/src/App.tsx` contains `ProtectedRoute allowedRoles={[Role.TENANT_ADMIN]}` for the admin route block.
- `/admin/tenant`, `/admin/tables`, and `/admin/analytics` are present inside that tenant-admin-only block.
- The admin route block does not contain `Role.MANAGER`.

Note:
- This repository does not currently include a browser test runner. This test verifies the route guard source statically.

Location:
- `server/src/tests/integration.test.ts`

## Exact Final Test Output
```text
> @mumo/server@1.0.0 test
> vitest run

RUN  v1.6.1 /home/evans/Projects/Mumo Capital & Syntax POS/server

✓ src/tests/requireRole.test.ts  (6 tests) 36ms
✓ src/tests/auth.test.ts  (7 tests) 61ms
POST /api/public/reservations/<id>/checkin 200
POST /api/orders 201
POST /api/public/reservations/<id>/checkin 409
POST /api/orders 409
✓ src/tests/integration.test.ts  (4 tests) 1369ms
POST /api/inventory/<id>/adjust 200
POST /api/inventory/<id>/adjust 400
POST /api/tables/<id>/settle-orders 200
POST /api/tables/<id>/settle-orders 400
POST /api/payments 201
POST /api/payments 201
POST /api/payments 201
POST /api/payments 400
POST /api/vendors/orders 404
✓ src/tests/concurrency.test.ts  (8 tests) 2507ms

Test Files  4 passed (4)
Tests       25 passed (25)
```

## Closure Decision
Audit closure: PASS ✅

The 8 minimum regression areas are covered and passing. Two client checks are static source tests because the project does not yet have a browser/E2E test runner.
