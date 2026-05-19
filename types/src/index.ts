export interface Tenant {
    id: string;
    name: string;
    domain?: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export enum Role {
    SUPER_ADMIN = 'SUPER_ADMIN',
    TENANT_ADMIN = 'TENANT_ADMIN',
    MANAGER = 'MANAGER',
    STAFF = 'STAFF'
}

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
    id: string;
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    hourlyRate: number;
    status: UserStatus;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface AuthPayload {
    id: string;
    tenantId: string;
    role: Role;
}

export interface MenuItem {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    price: number;
    categoryId?: string;
    isAvailable: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export enum OrderStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    PREPARING = 'PREPARING',
    READY = 'READY',
    SERVED = 'SERVED',
    CANCELLED = 'CANCELLED'
}

export interface Order {
    id: string;
    tenantId: string;
    tableId?: string;
    userId: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: string | Date;
    updatedAt: string | Date;
    items?: OrderItem[];
    table?: Table;
}

export interface OrderItem {
    id: string;
    orderId: string;
    menuItemId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface Table {
    id: string;
    tenantId: string;
    number: string;
    capacity: number;
    isOccupied: boolean;
}

export enum PaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED'
}

export interface Payment {
    id: string;
    tenantId: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    method: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

// ── Reservations ─────────────────────────────────────────────────────────────

export enum ReservationStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    SEATED = 'SEATED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW'
}

export interface Reservation {
    id: string;
    tenantId: string;
    tableId?: string;
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    guestCount: number;
    startTime: string | Date;
    endTime?: string | Date;
    status: ReservationStatus;
    notes?: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    table?: Table;
}

// ── Customers / Loyalty ──────────────────────────────────────────────────────

export interface Customer {
    id: string;
    tenantId: string;
    name: string;
    email?: string;
    phone?: string;
    totalSpend: number;
    visitCount: number;
    loyaltyPoints: number;
    createdAt: string | Date;
    updatedAt: string | Date;
}

// ── Inventory ────────────────────────────────────────────────────────────────

export enum AdjustmentType {
    AUDIT = 'AUDIT',
    PURCHASE = 'PURCHASE',
    SALE = 'SALE',
    WASTE = 'WASTE'
}

export interface InventoryItem {
    id: string;
    tenantId: string;
    name: string;
    sku?: string;
    unit: string;
    currentStock: number;
    minStock: number;
    costPerUnit: number;
    supplierId?: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export enum OutletType {
    RESTAURANT = 'RESTAURANT',
    BAR = 'BAR',
    CAFE = 'CAFE',
    ROOM_SERVICE = 'ROOM_SERVICE',
    POOL_BAR = 'POOL_BAR',
}

export interface OperatingHours {
    [day: string]: { open: string; close: string };
}

export interface ReceiptConfig {
    header?: string;
    footer?: string;
    showTax?: boolean;
    headerText?: string;
    footerText?: string;
    showTaxBreakdown?: boolean;
    showLogo: boolean;
}

// ── Tenant Settings ──────────────────────────────────────────────────────────

export interface TenantSettings {
    id: string;
    tenantId: string;
    displayName?: string;
    currency: string;
    taxRate: number;
    logoUrl?: string;
    primaryColor?: string;
    timezone: string;
    outletType?: OutletType;
    operatingHours?: OperatingHours;
    receiptConfig?: ReceiptConfig;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface ServiceRequest {
    id: string;
    tenantId: string;
    roomNumber: string;
    category: string;
    description: string;
    status: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface Activity {
    id: string;
    tenantId: string;
    name: string;
    description: string;
    duration: number;
    price: number;
    maxCapacity: number;
    availableSlots: number;
    imageUrl?: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface ActivityBooking {
    id: string;
    tenantId: string;
    activityId: string;
    roomNumber: string;
    guestName: string;
    slotTime: string | Date;
    status: string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface Shift {
    id: string;
    tenantId: string;
    userId: string;
    date: string | Date;
    startTime: string | Date;
    endTime: string | Date;
    station: string;
    createdAt: string | Date;
}

export type ClockEventType = 'IN' | 'OUT';

export interface ClockEvent {
    id: string;
    tenantId: string;
    userId: string;
    type: ClockEventType;
    timestamp: string | Date;
    createdAt: string | Date;
}

// ── Vendors & Purchasing ───────────────────────────────────────────────────

export interface Vendor {
    id: string;
    tenantId: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    categories: string[];
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface PurchaseOrderItem {
    id: string;
    purchaseOrderId: string;
    inventoryItemId: string;
    orderedQty: number;
    receivedQty: number | null;
    unitCost: number;
    createdAt: string | Date;
    inventoryItem?: InventoryItem;
}

export interface PurchaseOrder {
    id: string;
    tenantId: string;
    vendorId: string;
    status: 'DRAFT' | 'SENT' | 'RECEIVED';
    totalCost: number;
    createdAt: string | Date;
    updatedAt: string | Date;
    items: PurchaseOrderItem[];
    vendor?: Vendor;
}

export interface InventoryAuditLog {
    id: string;
    tenantId: string;
    inventoryItemId: string;
    previousQty: number;
    newQty: number;
    adjustmentType: 'AUDIT' | 'PURCHASE' | 'SALE' | 'WASTE';
    reason: string;
    userId: string;
    createdAt: string | Date;
}

export interface RevenueData {
    date: string;
    amount: number;
    outletType: string;
}

export interface OccupancyData {
    hour: number;
    day: string;
    rate: number;
}

export interface MenuPerformanceData {
    itemId: string;
    name: string;
    revenue: number;
    orderCount: number;
}

export interface LaborData {
    userId: string;
    name: string;
    scheduledHours: number;
    hourlyRate: number;
    totalCost: number;
}

export interface InventorySnapshotData {
    totalValue: number;
    itemsBelowThreshold: number;
    averageDaysRemaining: number;
}
