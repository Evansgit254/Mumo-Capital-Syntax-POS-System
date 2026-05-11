/// <reference types="vite/client" />
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useStore } from '../store/useStore';
import { 
    MenuItem, 
    Order, 
    Table, 
    Payment, 
    OrderStatus, 
    PaymentStatus 
} from '@mumo/types';

// ── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // FIX 11: Send httpOnly cookies with every request
});

export const getPublicClient = (tenantId: string) => {
    return axios.create({
        baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
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
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
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
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const { setSession, clearSession } = useStore.getState();

            try {
                // FIX 11: Refresh token is sent automatically via httpOnly cookie.
                // No need to read it from state or send it in the body.
                const res = await axios.post(
                    `${api.defaults.baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );
                const { accessToken: newToken } = res.data;
                
                setSession({ token: newToken });
                processQueue(null, newToken);
                
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                clearSession();
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

// ── Session Restoration ──────────────────────────────────────────────────────
// FIX 11: On page reload, attempt to restore access token from httpOnly cookie
// via a silent refresh call. Call this once on app initialization.
export async function restoreSession(): Promise<boolean> {
    try {
        const res = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            { withCredentials: true }
        );
        const { accessToken } = res.data;
        if (accessToken) {
            useStore.getState().setSession({ token: accessToken });
            return true;
        }
        return false;
    } catch {
        // No valid refresh cookie — user must log in
        return false;
    }
}

// ── Error Helper ─────────────────────────────────────────────────────────────
export const getErrorMessage = (error: unknown): string => {
    if (error instanceof AxiosError) {
        return error.response?.data?.error || error.message;
    }
    return (error as Error).message || 'An unexpected error occurred';
};

// ── Service Layer ────────────────────────────────────────────────────────────

export const menuService = {
    getAll: () => api.get<MenuItem[]>('/api/menus').then(r => r.data),
    getOne: (id: string) => api.get<MenuItem>(`/api/menus/${id}`).then(r => r.data),
    create: (data: Partial<MenuItem>) => api.post<MenuItem>('/api/menus', data).then(r => r.data),
    update: (id: string, data: Partial<MenuItem>) => api.put<MenuItem>(`/api/menus/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/api/menus/${id}`).then(r => r.data),
};

export const orderService = {
    getAll: () => api.get<Order[]>('/api/orders').then(r => r.data),
    getLive: () => api.get<any[]>('/api/orders/live').then(r => r.data),
    getOne: (id: string) => api.get<Order>(`/api/orders/${id}`).then(r => r.data),
    create: (data: { tableId?: string; items: { menuItemId: string; quantity: number }[] }) => 
        api.post<Order>('/api/orders', data).then(r => r.data),
    updateStatus: (id: string, status: OrderStatus) => 
        api.put<Order>(`/api/orders/${id}/status`, { status }).then(r => r.data),
};

export const tableService = {
    getAll: () => api.get<Table[]>('/api/tables').then(r => r.data),
    getOne: (id: string) => api.get<Table>(`/api/tables/${id}`).then(r => r.data),
    getOrders: (id: string) => api.get<Order[]>(`/api/tables/${id}/orders`).then(r => r.data),
    create: (data: Partial<Table>) => api.post<Table>('/api/tables', data).then(r => r.data),
    update: (id: string, data: Partial<Table>) => api.put<Table>(`/api/tables/${id}`, data).then(r => r.data),
    batchUpdate: (tables: any[]) => api.put<{ updated: number; tables: Table[] }>('/api/tables/batch', { tables }).then(r => r.data),
    delete: (id: string) => api.delete(`/api/tables/${id}`).then(r => r.data),
    settle: (id: string) => api.post<Table>(`/api/tables/${id}/settle`).then(r => r.data),
    transfer: (id: string, targetTableId: string) => api.post<Table>(`/api/tables/${id}/transfer`, { targetTableId }).then(r => r.data),
    merge: (id: string, targetTableId: string) => api.post<Table>(`/api/tables/${id}/merge`, { targetTableId }).then(r => r.data),
};

export const reservationService = {
    getAll: (params?: { date?: string; status?: string }) => 
        api.get<any[]>('/api/reservations', { params }).then(r => r.data),
    getWaitlist: () => api.get<any[]>('/api/reservations/waitlist').then(r => r.data),
    getOne: (id: string) => api.get<any>(`/api/reservations/${id}`).then(r => r.data),
    create: (data: any) => api.post<any>('/api/reservations', data).then(r => r.data),
    update: (id: string, data: any) => api.put<any>(`/api/reservations/${id}`, data).then(r => r.data),
    checkIn: (id: string) => api.post<any>(`/api/reservations/${id}/checkin`).then(r => r.data),
    cancel: (id: string) => api.delete(`/api/reservations/${id}`).then(r => r.data),
};

export const inventoryService = {
    getAll: () => api.get<any[]>('/api/inventory').then(r => r.data),
    getAlerts: () => api.get<any[]>('/api/inventory', { params: { alert: true } }).then(r => r.data),
    getOne: (id: string) => api.get<any>(`/api/inventory/${id}`).then(r => r.data),
    create: (data: any) => api.post<any>('/api/inventory', data).then(r => r.data),
    update: (id: string, data: any) => api.put<any>(`/api/inventory/${id}`, data).then(r => r.data),
    adjust: (id: string, data: any) => api.post<any>(`/api/inventory/${id}/adjust`, data).then(r => r.data),
    getAuditLog: (params?: { page?: number; limit?: number }) => 
        api.get<any>('/api/inventory/audit-log', { params }).then(r => r.data),
};

export const vendorService = {
    getAll: () => api.get<any[]>('/api/vendors').then(r => r.data),
    getOne: (id: string) => api.get<any>(`/api/vendors/${id}`).then(r => r.data),
    create: (data: any) => api.post<any>('/api/vendors', data).then(r => r.data),
    update: (id: string, data: any) => api.put<any>(`/api/vendors/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/api/vendors/${id}`).then(r => r.data),
};

export const purchaseOrderService = {
    getAll: () => api.get<any[]>('/api/vendors/orders').then(r => r.data),
    create: (data: any) => api.post<any>('/api/vendors/orders', data).then(r => r.data),
    updateStatus: (id: string, status: string, receivedItems?: any[]) => 
        api.patch<any>(`/api/vendors/orders/${id}/status`, { status, receivedItems }).then(r => r.data),
};

export const customerService = {
    getAll: (search?: string) => 
        api.get<any[]>('/api/customers', { params: { search } }).then(r => r.data),
    create: (data: any) => api.post<any>('/api/customers', data).then(r => r.data),
    update: (id: string, data: any) => api.put<any>(`/api/customers/${id}`, data).then(r => r.data),
};

export const tenantService = {
    getSettings: () => api.get<any>('/api/tenants/settings').then(r => r.data),
    updateSettings: (data: any) => api.put<any>('/api/tenants/settings', data).then(r => r.data),
};

export const userService = {
    getAll: () => api.get<any[]>('/api/users').then(r => r.data),
    create: (data: any) => api.post<any>('/api/users', data).then(r => r.data),
    updateRole: (id: string, role: string) => 
        api.put<any>(`/api/users/${id}/role`, { role }).then(r => r.data),
    updateStatus: (id: string, status: string) => 
        api.put<any>(`/api/users/${id}/status`, { status }).then(r => r.data),
    updateRate: (id: string, hourlyRate: number) =>
        api.put<any>(`/api/users/${id}/rate`, { hourlyRate }).then(r => r.data),
};

export const permissionService = {
    getRolePermissions: (role: string) => 
        api.get<any>(`/api/roles/${role}/permissions`).then(r => r.data),
    updateRolePermissions: (role: string, permissions: string[]) => 
        api.put<any>(`/api/roles/${role}/permissions`, { permissions }).then(r => r.data),
};

export const paymentService = {
    getAll: () => api.get<Payment[]>('/api/payments').then(r => r.data),
    getOne: (id: string) => api.get<Payment>(`/api/payments/${id}`).then(r => r.data),
    create: (data: { orderId: string; amount: number; method: string }) => 
        api.post<Payment>('/api/payments', data).then(r => r.data),
    updateStatus: (id: string, status: PaymentStatus) => 
        api.put<Payment>(`/api/payments/${id}/status`, { status }).then(r => r.data),
};

export const guestService = {
    lookupReservation: (data: { id?: string; guestName?: string }) => 
        api.post<any>('/api/public/reservations/lookup', data).then(r => r.data),
    checkIn: (id: string) => 
        api.post<any>(`/api/public/reservations/${id}/checkin`).then(r => r.data),
    getMenu: () => 
        api.get<MenuItem[]>('/api/public/menus').then(r => r.data),
    placeOrder: (data: { tableId: string; items: { menuItemId: string; quantity: number }[] }) => 
        api.post<Order>('/api/public/orders', data).then(r => r.data),
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
            api.get<Order[]>('/api/orders', { params: { roomId } }),
            api.get<Payment[]>('/api/payments', { params: { roomId } })
        ]);
        return { orders: ordersRes.data, payments: paymentsRes.data };
    },
    getCheckedInGuests: (filters?: any) => 
        api.get<any[]>('/api/reservations', { params: { status: 'checked-in', ...filters } }).then(r => r.data),
    getGuestById: (reservationId: string) => 
        api.get<any>(`/api/reservations/${reservationId}`).then(r => r.data),
    checkoutFolio: (roomId: string, payload: any) => 
        api.post<any>('/api/payments/folio', { roomId, ...payload }).then(r => r.data),
};

export const shiftService = {
    getAll: (params?: { start?: string; end?: string }) => 
        api.get<any[]>('/api/shifts', { params }).then(r => r.data),
    create: (data: any) => 
        api.post<any>('/api/shifts', data).then(r => r.data),
    update: (id: string, data: any) => 
        api.put<any>(`/api/shifts/${id}`, data).then(r => r.data),
    delete: (id: string) => 
        api.delete(`/api/shifts/${id}`).then(r => r.data),
};

export const clockEventService = {
    getAll: () => 
        api.get<any[]>('/api/clock-events').then(r => r.data),
    create: (data: { userId?: string; type: 'IN' | 'OUT' }) => 
        api.post<any>('/api/clock-events', data).then(r => r.data),
};

export default api;
