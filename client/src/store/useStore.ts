import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Role, OrderItem } from '@mumo/types';

interface Session {
    token: string | null;       // Access token — memory only, never persisted
    tenantId: string | null;
    tenantName: string | null;
    role: Role | null;
    userId: string | null;
    email: string | null;
    firstName: string | null;
}

interface CartItem extends Omit<OrderItem, 'id' | 'orderId'> {
    cartLineId: string;
    name: string;
    modifiers: string[];
    notes?: string | null;
}

interface HardwareSettings {
    printerIp: string;
    printerPort: string;
    scannerEnabled: boolean;
    theme: 'light' | 'dark';
}

interface SuperAdminSession {
    token: string | null;
    id: string | null;
    email: string | null;
    name: string | null;
}

interface StoreState {
    // Session Slice (memory-only, NOT persisted)
    session: Session;
    setSession: (session: Partial<Session>) => void;
    clearSession: () => void;
    logout: () => void;

    // Super Admin Slice (memory-only)
    superAdmin: SuperAdminSession;
    setSuperAdmin: (data: Partial<SuperAdminSession>) => void;
    clearSuperAdmin: () => void;

    // Cart Slice
    cart: {
        tableId: string | null;
        items: CartItem[];
        setTableId: (id: string | null) => void;
        addItem: (item: Omit<CartItem, 'cartLineId'>) => void;
        removeItem: (cartLineId: string) => void;
        updateQuantity: (cartLineId: string, delta: number) => void;
        clearCart: () => void;
    };

    // UI Slice
    ui: {
        sidebarOpen: boolean;
        setSidebarOpen: (open: boolean) => void;
        primaryColor: string;
        setPrimaryColor: (color: string) => void;
    };

    // Hardware/Settings Slice (persisted to localStorage)
    hardware: HardwareSettings;
    setHardware: (updates: Partial<HardwareSettings>) => void;

    // Guest Slice (Non-persistent context for public flows)
    guest: {
        tenantId: string | null;
        setTenantId: (id: string | null) => void;
    };
}

const defaultSession: Session = {
    token: null,
    tenantId: null,
    tenantName: null,
    role: null,
    userId: null,
    email: null,
    firstName: null,
};

const defaultSuperAdmin: SuperAdminSession = {
    token: null,
    id: null,
    email: null,
    name: null,
};

export const useStore = create<StoreState>()(
    persist(
        (set) => ({
            // Session (memory-only — FIX 11: NOT included in partialize)
            session: { ...defaultSession },
            setSession: (updates) =>
                set((state) => ({
                    session: { ...state.session, ...updates },
                })),
            clearSession: () =>
                set({
                    session: { ...defaultSession },
                }),

            // DEEP-WARN-014: Single logout action that clears everything
            logout: () =>
                set((state) => ({
                    session: { ...defaultSession },
                    superAdmin: { ...defaultSuperAdmin },
                    cart: {
                        ...state.cart,
                        tableId: null,
                        items: [],
                    },
                    ui: {
                        ...state.ui,
                        sidebarOpen: false,
                    },
                })),

            // Super Admin
            superAdmin: { ...defaultSuperAdmin },
            setSuperAdmin: (updates) =>
                set((state) => ({
                    superAdmin: { ...state.superAdmin, ...updates },
                })),
            clearSuperAdmin: () =>
                set({ superAdmin: { ...defaultSuperAdmin } }),

            // Guest
            guest: {
                tenantId: null,
                setTenantId: (tenantId) => set((state) => ({ 
                    guest: { ...state.guest, tenantId } 
                })),
            },

            // Cart
            cart: {
                tableId: null,
                items: [],
                setTableId: (tableId) =>
                    set((state) => ({
                        cart: { ...state.cart, tableId },
                    })),
                addItem: (newItem) =>
                    set((state) => {
                        const modifierKey = JSON.stringify((newItem.modifiers ?? []).sort());
                        const cartLineId = `${newItem.menuItemId}__${modifierKey}`;

                        const existing = state.cart.items.find((i) => i.cartLineId === cartLineId);

                        if (existing) {
                            return {
                                cart: {
                                    ...state.cart,
                                    items: state.cart.items.map((i) =>
                                        i.cartLineId === cartLineId
                                            ? {
                                                  ...i,
                                                  quantity: i.quantity + newItem.quantity,
                                                  subtotal: (i.quantity + newItem.quantity) * i.unitPrice,
                                              }
                                            : i
                                    ),
                                },
                            };
                        }

                        return {
                            cart: {
                                ...state.cart,
                                items: [...state.cart.items, { ...newItem, cartLineId }],
                            },
                        };
                    }),
                removeItem: (cartLineId) =>
                    set((state) => ({
                        cart: {
                            ...state.cart,
                            items: state.cart.items.filter((i) => i.cartLineId !== cartLineId),
                        },
                    })),
                updateQuantity: (cartLineId, delta) =>
                    set((state) => ({
                        cart: {
                            ...state.cart,
                            items: state.cart.items
                                .map((i) => {
                                    if (i.cartLineId === cartLineId) {
                                        const newQty = Math.max(0, i.quantity + delta);
                                        return {
                                            ...i,
                                            quantity: newQty,
                                            subtotal: newQty * i.unitPrice,
                                        };
                                    }
                                    return i;
                                })
                                .filter((i) => i.quantity > 0),
                        },
                    })),
                clearCart: () =>
                    set((state) => ({
                        cart: { ...state.cart, items: [], tableId: null },
                    })),
            },

            // UI
            ui: {
                sidebarOpen: true,
                setSidebarOpen: (sidebarOpen) =>
                    set((state) => ({
                        ui: { ...state.ui, sidebarOpen },
                    })),
                primaryColor: 'var(--color-secondary)',
                setPrimaryColor: (primaryColor) =>
                    set((state) => ({
                        ui: { ...state.ui, primaryColor },
                    })),
            },

            // Hardware/Settings
            hardware: {
                printerIp: '',
                printerPort: '9100',
                scannerEnabled: false,
                theme: 'dark',
            },
            setHardware: (updates) =>
                set((state) => ({
                    hardware: { ...state.hardware, ...updates },
                })),
        }),
        {
            name: 'mumo-pos-storage',
            storage: createJSONStorage(() => localStorage),
            // FIX 11 — WARN-018: Only persist hardware + UI preferences.
            // Session (access token) is NEVER persisted — it lives in memory only.
            // Refresh token lives in an httpOnly cookie set by the server.
            partialize: (state) => ({
                hardware: state.hardware,
                ui: { sidebarOpen: state.ui.sidebarOpen, primaryColor: state.ui.primaryColor },
            }),
        }
    )
);
