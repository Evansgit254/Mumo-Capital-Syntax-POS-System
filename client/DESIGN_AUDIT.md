# Design Audit — Mumo POS
Generated: 2026-05-05

## Summary
- **Total Stitch screens**: 30
- **Fully implemented**: 5
- **Partially implemented**: 2
- **Missing**: 23

## Fully Implemented
| Stitch Screen Name | File Path |
|---|---|
| POS Interface | [`POSPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/POSPage.tsx) |
| Interactive Floor Plan | [`TableMapPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/TableMapPage.tsx) |
| Outlet Menu Manager | [`MenuManagerPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/MenuManagerPage.tsx) |
| Billing & Settlement | [`CheckoutPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/CheckoutPage.tsx) |
| Splash / Sign-In | [`LoginPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/LoginPage.tsx) |

## Partially Implemented
| Stitch Screen Name | File Path | Gap Description |
|---|---|---|
| Staff Dashboard | [`DashboardPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/DashboardPage.tsx) | Missing "Inventory Alerts" and "Upcoming Reservations" dynamic cards; uses static data for occupancy chart. |
| Reports & Analytics | [`ReportsPage.tsx`](file:///home/evans/Projects/Mumo%20Capital%20&%20Syntax%20POS/client/src/pages/ReportsPage.tsx) | Missing the detailed ledger transaction view with search/filter capabilities. |

## Missing
| Stitch Screen Name | Description | Suggested Location |
|---|---|---|
| Kitchen Display System (KDS) | Real-time order tracking for kitchen staff. | `src/pages/KDSPage.tsx` |
| Reservations & Waitlist | Guest booking and table allocation management. | `src/pages/ReservationsPage.tsx` |
| Loyalty & Discounts | Customer profile management and reward redemption. | `src/pages/LoyaltyPage.tsx` |
| Inventory & Stock Control | Direct adjustment and tracking of supply levels. | `src/pages/InventoryPage.tsx` |
| Table Service Details | Fine-grained order control per seat/table. | `src/pages/TableDetailsPage.tsx` |
| Staff Permissions Management | Role-based access control configuration. | `src/pages/admin/PermissionsPage.tsx` |
| Tenant Administration | Global multi-tenant configuration settings. | `src/pages/admin/TenantPage.tsx` |
| Hardware & Peripherals | Printer and scanner hardware setup. | `src/pages/SettingsPage.tsx` |
| Mobile Check-In | Guest-facing resort arrival flow. | `src/pages/reception/CheckInPage.tsx` |
| Digital Room Service | Guest-facing mobile ordering interface. | `src/pages/RoomServicePage.tsx` |

## Component Gaps
- **Modifier Selection Modal**: No implementation for menu item modifiers (e.g. "Rare/Medium", "No Onions").
- **Split Bill Logic**: The checkout page only supports single-method full settlement; Stitch defines complex split-payment flows.
- **Empty States**: No "No Results Found" or "Empty Inbox" visual states implemented in list views.
- **Form Validation States**: Error states for input fields are currently using browser defaults instead of the custom Stitch error theme.
- **Add Note Drawer**: Missing the slide-out drawer for adding specific cooking instructions to order items.
