/// <reference types="vite/client" />
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useStore } from '../store/useStore';
import { 
    MenuItem, 
    Order, 
    Table, 
    Payment, 
    OrderStatus, 
    PaymentStatus,
    Reservation,
    InventoryItem,
    Vendor,
    PurchaseOrder,
    Customer,
    TenantSettings,
    User,
    Shift,
    ClockEvent,
    InventoryAuditLog
} from '@mumo/types';

type QueueItem = {
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
};

type RefreshResponse = { 
    accessToken: string;
    user: User & { tenantName: string };
};
type LoginResponse = {
    accessToken: string;
    user: User & { tenantName: string };
};
type TableLayoutUpdate = Partial<Table> & { id: string; x?: number; y?: number };
type ReservationInput = Omit<Partial<Reservation>, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
type InventoryInput = Omit<Partial<InventoryItem>, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
type InventoryAdjustmentInput = { quantity: number; type: string; reason?: string };
type VendorInput = Omit<Partial<Vendor>, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
type PurchaseOrderInput = { vendorId: string; items: { inventoryItemId: string; orderedQty: number; unitCost: number }[] };
type ReceivedPurchaseOrderItem = { inventoryItemId: string; receivedQty: number; reason?: string };
type CustomerInput = Omit<Partial<Customer>, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
type TenantSettingsInput = Record<string, unknown>;
type CreateUserInput = { email: string; firstName: string; lastName: string; password: string; hourlyRate?: number };
type UserWithOptionalStatus = User & { status?: string };
type RolePermissions = { role: string; permissions: string[] };
type ReservationFilters = { date?: string; status?: string; start?: string; end?: string };
type FolioCheckoutPayload = { charges: { orderId: string; amount: number; method: 'CASH' | 'CARD' }[] };
type FolioCheckoutResponse = { folioId: string; totalSettled: number; payments: Payment[] };
type ShiftInput = { userId?: string; date?: string; startTime?: string; endTime?: string; station?: string };
type AuditLogResponse = { logs: InventoryAuditLog[]; total: number; page: number; limit: number };

// FIX 4 — CODEX-WARN-012: Standard paginated response envelope
export type PaginatedResponse<T> = {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};
type PaginationParams = { page?: number; limit?: number };

// ── Axios Instance ───────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) throw new Error(
  'FATAL: VITE_API_URL is not set. Check your .env file.'
);

const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // FIX 11: Send httpOnly cookies with every request
});

export const getPublicClient = (tenantId: string) => {
    return axios.create({
        baseURL: API_URL,
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId
        },
        withCredentials: true,
    });
};

// ── Interceptors ──────────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
    const { session, guest } = useStore.getState();
    const token = session.token;
    const tenantId = session.tenantId || guest.tenantId;
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (tenantId) {
        config.headers['x-tenant-id'] = tenantId;
    }
    
    return config;
});

// Mutex-style refresh logic
let isRefreshing = false;
let failedQueue: QueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null): void => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const newToken = await performRefresh();
                if (!newToken) throw error;
                
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (err) {
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

let refreshPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const res = await axios.post<RefreshResponse>(
                `${api.defaults.baseURL}/auth/refresh`,
                {},
                { withCredentials: true }
            );
            const { accessToken, user } = res.data;
            if (accessToken) {
                useStore.getState().setSession({ 
                    token: accessToken,
                    tenantId: user.tenantId,
                    tenantName: user.tenantName,
                    role: user.role,
                    userId: user.id,
                    email: user.email,
                    firstName: user.firstName,
                });
                return accessToken;
            }
            return null;
        } catch (err) {
            useStore.getState().setSession({
                token: null,
                tenantId: null,
                tenantName: null,
                role: null,
                userId: null,
                email: null,
                firstName: null,
            });
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// ── Session Restoration ──────────────────────────────────────────────────────
// FIX 11: On page reload, attempt to restore access token from httpOnly cookie
// via a silent refresh call. Call this once on app initialization.
export async function restoreSession(): Promise<boolean> {
    const token = await performRefresh();
    return !!token;
}

// ── Error Helper ─────────────────────────────────────────────────────────────
export const getErrorMessage = (error: unknown): string => {
    if (error instanceof AxiosError) {
        return error.response?.data?.error || error.message;
    }
    return (error as Error).message || 'An unexpected error occurred';
};

// ── Service Layer ────────────────────────────────────────────────────────────

export const authService = {
    login: (data: { email: string; password: string }) =>
        api.post<LoginResponse>('/auth/login', data).then(r => r.data),
};

export const menuService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<MenuItem>>('/api/menus', { params }).then(r => r.data),
    getOne: (id: string) => api.get<MenuItem>(`/api/menus/${id}`).then(r => r.data),
    getModifiers: (id: string) => api.get<{ id: string; name: string; price: number }[]>(`/api/menus/${id}/modifiers`).then(r => r.data),
    create: (data: Partial<MenuItem>) => api.post<MenuItem>('/api/menus', data).then(r => r.data),
    update: (id: string, data: Partial<MenuItem>) => api.put<MenuItem>(`/api/menus/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/api/menus/${id}`).then(r => r.data),
};

export const orderService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<Order>>('/api/orders', { params }).then(r => r.data),
    getLive: () => api.get<Order[]>('/api/orders/live').then(r => r.data),
    getOne: (id: string) => api.get<Order>(`/api/orders/${id}`).then(r => r.data),
    create: (data: { tableId?: string; items: { menuItemId: string; quantity: number }[] }) => 
        api.post<Order>('/api/orders', data).then(r => r.data),
    updateStatus: (id: string, status: OrderStatus) => 
        api.put<Order>(`/api/orders/${id}/status`, { status }).then(r => r.data),
};

export const tableService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<Table>>('/api/tables', { params }).then(r => r.data),
    getOne: (id: string) => api.get<Table>(`/api/tables/${id}`).then(r => r.data),
    getOrders: (id: string) => api.get<Order[]>(`/api/tables/${id}/orders`).then(r => r.data),
    create: (data: Partial<Table>) => api.post<Table>('/api/tables', data).then(r => r.data),
    update: (id: string, data: Partial<Table>) => api.put<Table>(`/api/tables/${id}`, data).then(r => r.data),
    batchUpdate: (tables: TableLayoutUpdate[]) => api.put<{ updated: number; tables: Table[] }>('/api/tables/batch', { tables }).then(r => r.data),
    delete: (id: string) => api.delete(`/api/tables/${id}`).then(r => r.data),
    settle: (id: string) => api.post<Table>(`/api/tables/${id}/settle`).then(r => r.data),
    transfer: (id: string, targetTableId: string) => api.post<Table>(`/api/tables/${id}/transfer`, { targetTableId }).then(r => r.data),
    merge: (id: string, targetTableId: string) => api.post<Table>(`/api/tables/${id}/merge`, { targetTableId }).then(r => r.data),
};

export const reservationService = {
    getAll: (params?: { date?: string; status?: string; page?: number; limit?: number }) => 
        api.get<PaginatedResponse<Reservation>>('/api/reservations', { params }).then(r => r.data),
    getWaitlist: () => api.get<Reservation[]>('/api/reservations/waitlist').then(r => r.data),
    getOne: (id: string) => api.get<Reservation>(`/api/reservations/${id}`).then(r => r.data),
    create: (data: ReservationInput) => api.post<Reservation>('/api/reservations', data).then(r => r.data),
    update: (id: string, data: ReservationInput) => api.put<Reservation>(`/api/reservations/${id}`, data).then(r => r.data),
    checkIn: (id: string) => api.post<Reservation>(`/api/reservations/${id}/checkin`).then(r => r.data),
    cancel: (id: string) => api.delete(`/api/reservations/${id}`).then(r => r.data),
};

export const inventoryService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<InventoryItem>>('/api/inventory', { params }).then(r => r.data),
    getAlerts: (params?: PaginationParams) => api.get<PaginatedResponse<InventoryItem>>('/api/inventory', { params: { alert: true, ...params } }).then(r => r.data),
    getOne: (id: string) => api.get<InventoryItem>(`/api/inventory/${id}`).then(r => r.data),
    create: (data: InventoryInput) => api.post<InventoryItem>('/api/inventory', data).then(r => r.data),
    update: (id: string, data: InventoryInput) => api.put<InventoryItem>(`/api/inventory/${id}`, data).then(r => r.data),
    adjust: (id: string, data: InventoryAdjustmentInput) => api.post<InventoryItem>(`/api/inventory/${id}/adjust`, data).then(r => r.data),
    getAuditLog: (params?: { page?: number; limit?: number }) => 
        api.get<AuditLogResponse>('/api/inventory/audit-log', { params }).then(r => r.data),
    delete: (id: string) => api.delete(`/api/inventory/${id}`).then(r => r.data),
};

export const vendorService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<Vendor>>('/api/vendors', { params }).then(r => r.data),
    getOne: (id: string) => api.get<Vendor>(`/api/vendors/${id}`).then(r => r.data),
    create: (data: VendorInput) => api.post<Vendor>('/api/vendors', data).then(r => r.data),
    update: (id: string, data: VendorInput) => api.put<Vendor>(`/api/vendors/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/api/vendors/${id}`).then(r => r.data),
};

export const purchaseOrderService = {
    getAll: () => api.get<PurchaseOrder[]>('/api/vendors/orders').then(r => r.data),
    create: (data: PurchaseOrderInput) => api.post<PurchaseOrder>('/api/vendors/orders', data).then(r => r.data),
    updateStatus: (id: string, status: PurchaseOrder['status'], receivedItems?: ReceivedPurchaseOrderItem[]) => 
        api.patch<PurchaseOrder | { message: string }>(`/api/vendors/orders/${id}/status`, { status, receivedItems }).then(r => r.data),
};

export const customerService = {
    getAll: (search?: string, params?: PaginationParams) => 
        api.get<PaginatedResponse<Customer>>('/api/customers', { params: { search, ...params } }).then(r => r.data),
    create: (data: CustomerInput) => api.post<Customer>('/api/customers', data).then(r => r.data),
    update: (id: string, data: CustomerInput) => api.put<Customer>(`/api/customers/${id}`, data).then(r => r.data),
};

export const tenantService = {
    getSettings: () => api.get<TenantSettings>('/api/tenants/settings').then(r => r.data),
    updateSettings: (data: TenantSettingsInput) => api.put<TenantSettings>('/api/tenants/settings', data).then(r => r.data),
};

export const userService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<UserWithOptionalStatus>>('/api/users', { params }).then(r => r.data),
    create: (data: CreateUserInput) => api.post<User>('/api/users', data).then(r => r.data),
    updateRole: (id: string, role: string) => 
        api.put<User>(`/api/users/${id}/role`, { role }).then(r => r.data),
    updateStatus: (id: string, status: string) => 
        api.put<User>(`/api/users/${id}/status`, { status }).then(r => r.data),
    updateRate: (id: string, hourlyRate: number) =>
        api.put<User>(`/api/users/${id}/rate`, { hourlyRate }).then(r => r.data),
};

export const permissionService = {
    getRolePermissions: (role: string) => 
        api.get<RolePermissions>(`/api/roles/${role}/permissions`).then(r => r.data),
    updateRolePermissions: (role: string, permissions: string[]) => 
        api.put<RolePermissions>(`/api/roles/${role}/permissions`, { permissions }).then(r => r.data),
};

export const paymentService = {
    getAll: (params?: PaginationParams) => api.get<PaginatedResponse<Payment>>('/api/payments', { params }).then(r => r.data),
    getOne: (id: string) => api.get<Payment>(`/api/payments/${id}`).then(r => r.data),
    create: (data: { orderId: string; amount: number; method: string }) => 
        api.post<Payment>('/api/payments', data).then(r => r.data),
    updateStatus: (id: string, status: PaymentStatus) => 
        api.put<Payment>(`/api/payments/${id}/status`, { status }).then(r => r.data),
    checkoutFolio: (roomId: string, payload: FolioCheckoutPayload) =>
        api.post<FolioCheckoutResponse>('/api/payments/folio', { roomId, ...payload }).then(r => r.data),
};

export const guestService = {
    lookupReservation: (data: { id?: string; guestName?: string }) => 
        api.post<Reservation>('/api/public/reservations/lookup', data).then(r => r.data),
    checkIn: (id: string) => 
        api.post<Reservation>(`/api/public/reservations/${id}/checkin`).then(r => r.data),
    getMenu: () => 
        api.get<MenuItem[]>('/api/public/menus').then(r => r.data),
    placeOrder: (data: { tableId: string; items: { menuItemId: string; quantity: number }[] }) => 
        api.post<Order>('/api/public/orders/external', data).then(r => r.data),
    getRooms: () => 
        api.get<Table[]>('/api/public/tables').then(r => r.data),
};

export interface FolioData {
    orders: Order[];
    payments: Payment[];
}

export const guestFolioService = {
    getFolioCharges: async (roomId: string): Promise<FolioData> => {
        const [ordersRes, paymentsRes] = await Promise.all([
            api.get<PaginatedResponse<Order>>('/api/orders', { params: { roomId } }),
            api.get<PaginatedResponse<Payment>>('/api/payments', { params: { roomId } })
        ]);
        return { orders: ordersRes.data.data, payments: paymentsRes.data.data };
    },
    getCheckedInGuests: (filters?: ReservationFilters) => 
        api.get<PaginatedResponse<Reservation>>('/api/reservations', { params: { status: 'checked-in', ...filters } }).then(r => r.data),
    getGuestById: (reservationId: string) => 
        api.get<Reservation>(`/api/reservations/${reservationId}`).then(r => r.data),
    checkoutFolio: (roomId: string, payload: FolioCheckoutPayload) => 
        api.post<FolioCheckoutResponse>('/api/payments/folio', { roomId, ...payload }).then(r => r.data),
};

export const shiftService = {
    getAll: (params?: { start?: string; end?: string }) => 
        api.get<Shift[]>('/api/shifts', { params }).then(r => r.data),
    create: (data: ShiftInput) => 
        api.post<Shift>('/api/shifts', data).then(r => r.data),
    update: (id: string, data: ShiftInput) => 
        api.put<Shift>(`/api/shifts/${id}`, data).then(r => r.data),
    delete: (id: string) => 
        api.delete(`/api/shifts/${id}`).then(r => r.data),
};

export const clockEventService = {
    getAll: () => 
        api.get<ClockEvent[]>('/api/clock-events').then(r => r.data),
    create: (data: { userId?: string; type: 'IN' | 'OUT' }) => 
        api.post<ClockEvent>('/api/clock-events', data).then(r => r.data),
};

export default api;
