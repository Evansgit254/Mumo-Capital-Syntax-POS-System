# Route Audit — Mumo POS Server
Generated: 2026-05-05

## Existing Routes

| Method | Path | Auth Required | Role Restrictions |
|---|---|---|---|
| GET | `/health` | No | None |
| POST | `/auth/register` | No | None |
| POST | `/auth/login` | No | None |
| POST | `/auth/refresh` | No | None |
| GET | `/api/menus` | Yes | None |
| GET | `/api/menus/:id` | Yes | None |
| POST | `/api/menus` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| PUT | `/api/menus/:id` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| DELETE | `/api/menus/:id` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| GET | `/api/orders` | Yes | None |
| GET | `/api/orders/:id` | Yes | None |
| POST | `/api/orders` | Yes | None |
| PUT | `/api/orders/:id/status` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| GET | `/api/tables` | Yes | None |
| GET | `/api/tables/:id` | Yes | None |
| POST | `/api/tables` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| PUT | `/api/tables/:id` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| DELETE | `/api/tables/:id` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| GET | `/api/payments` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| GET | `/api/payments/:id` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |
| POST | `/api/payments` | Yes | None |
| PUT | `/api/payments/:id/status` | Yes | SUPER_ADMIN, TENANT_ADMIN, MANAGER |

## Gap Analysis

### Kitchen Display System (KDS)
- **Exists**: `PUT /api/orders/:id/status` (can transition to KITCHEN/READY/SERVED).
- **Missing**: `GET /api/orders/live`
    - **Description**: Fetch all active orders grouped by station (e.g., Hot, Cold, Bar).
    - **Body**: N/A
    - **Response**: `Order[]` (filtered by active status)
    - **Roles**: STAFF, MANAGER, TENANT_ADMIN

### Reservations & Waitlist
- **Missing**: Full CRUD on `/api/reservations`
    - **GET /api/reservations**: List all bookings for the tenant.
    - **POST /api/reservations**: Create a new booking (requires table mapping).
    - **Body**: `{ tableId: string, guestCount: number, startTime: DateTime, guestName: string }`
    - **Response**: `Reservation` object.
    - **Roles**: STAFF, MANAGER, TENANT_ADMIN
- **Missing**: `GET /api/waitlist`
    - **Description**: Fetch guests waiting for an available table.
    - **Roles**: STAFF, MANAGER, TENANT_ADMIN

### Loyalty & Discounts
- **Missing**: `GET/POST /api/customers`
    - **Description**: Manage customer profiles and total spend tracking.
    - **Body**: `{ email: string, phone: string, name: string }`
    - **Roles**: STAFF, MANAGER, TENANT_ADMIN
- **Missing**: `POST /api/discounts/redeem`
    - **Description**: Validate and apply a discount code to an active order.
    - **Body**: `{ orderId: string, code: string }`
    - **Response**: `{ success: boolean, newTotal: number }`
    - **Roles**: STAFF, MANAGER (Redemption might be restricted to managers)

### Inventory & Stock Control
- **Missing**: Full CRUD on `/api/inventory`
    - **Description**: Track raw materials and stock levels for menu items.
    - **Roles**: MANAGER, TENANT_ADMIN
- **Missing**: `POST /api/inventory/:id/adjust`
    - **Description**: Manual stock adjustment for wastage or restock.
    - **Body**: `{ adjustmentType: 'WASTE' | 'RESTOCK', quantity: number, reason: string }`
    - **Roles**: MANAGER, TENANT_ADMIN

### Table Service Details
- **Missing**: `GET /api/tables/:id/orders`
    - **Description**: Fetch current active orders specifically for one table to support per-seat management.
    - **Response**: `Order[]` (only active/unpaid)
    - **Roles**: STAFF, MANAGER, TENANT_ADMIN

### Staff Permissions
- **Missing**: `GET/PUT /api/roles/:id/permissions`
    - **Description**: Manage fine-grained permissions for specific roles within a tenant.
    - **Body**: `{ permissions: string[] }`
    - **Roles**: TENANT_ADMIN, SUPER_ADMIN

### Tenant Administration
- **Missing**: `GET/PUT /api/tenants/:id/settings`
    - **Description**: Manage tenant-wide settings (currency, tax rates, branding).
    - **Body**: `{ currency: string, taxRate: number, logoUrl: string }`
    - **Roles**: TENANT_ADMIN, SUPER_ADMIN

### Mobile Check-In
- **Missing**: `POST /api/reservations/:id/checkin`
    - **Description**: Mark a reservation as arrived and allocate the table.
    - **Body**: `{ arrivalTime: DateTime }`
    - **Roles**: STAFF, MANAGER, TENANT_ADMIN

### Digital Room Service
- **Confirmed**: `POST /api/orders` exists and is capable of handling room service orders if a `tableId` (representing the room) is provided.
