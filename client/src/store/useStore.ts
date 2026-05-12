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
    name: string; // For display
}

interface HardwareSettings {
    printerIp: string;
    printerPort: string;
    scannerEnabled: boolean;
    theme: 'light' | 'dark';
}

interface StoreState {
    // Session Slice (memory-only, NOT persisted)
    session: Session;
    setSession: (session: Partial<Session>) => void;
    clearSession: () => void;

    // Cart Slice
    cart: {
        tableId: string | null;
        items: CartItem[];
        setTableId: (id: string | null) => void;
        addItem: (item: CartItem) => void;
        removeItem: (menuItemId: string) => void;
        updateQuantity: (menuItemId: string, delta: number) => void;
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
                        const existing = state.cart.items.find(
                            (i) => i.menuItemId === newItem.menuItemId && i.name === newItem.name
                        );
                        if (existing) {
                            return {
                                cart: {
                                    ...state.cart,
                                    items: state.cart.items.map((i) =>
                                        i.menuItemId === newItem.menuItemId
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
                                items: [...state.cart.items, newItem],
                            },
                        };
                    }),
                removeItem: (menuItemId) =>
                    set((state) => ({
                        cart: {
                            ...state.cart,
                            items: state.cart.items.filter((i) => i.menuItemId !== menuItemId),
                        },
                    })),
                updateQuantity: (menuItemId, delta) =>
                    set((state) => ({
                        cart: {
                            ...state.cart,
                            items: state.cart.items
                                .map((i) => {
                                    if (i.menuItemId === menuItemId) {
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
