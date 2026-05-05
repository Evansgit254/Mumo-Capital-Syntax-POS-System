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
    status: UserStatus;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface AuthPayload {
    userId: string;
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
    WASTE = 'WASTE',
    RESTOCK = 'RESTOCK',
    TRANSFER = 'TRANSFER',
    CORRECTION = 'CORRECTION'
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
    createdAt: string | Date;
    updatedAt: string | Date;
}
