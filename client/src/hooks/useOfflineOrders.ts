import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { orderService } from '../api/service';
import { useStore } from '../store/useStore';
import {
  PendingOrder,
  savePendingOrder,
  getAllPendingOrders,
  deletePendingOrder,
} from '../lib/offlineOrderStore';

const RETRY_INTERVAL_MS = 30_000;

/** Returns true if the error is a network-level failure (timeout, offline, DNS, etc.) */
function isNetworkError(err: unknown): boolean {
  if (err instanceof AxiosError) {
    // No response at all → network error, not a 4xx/5xx
    return !err.response;
  }
  return false;
}

export interface UseOfflineOrdersReturn {
  /** True while there are locally saved orders waiting to sync */
  hasPendingOrders: boolean;
  /** The list of pending orders (for the recovery modal) */
  pendingOrders: PendingOrder[];
  /** Whether the offline banner should be shown */
  showOfflineBanner: boolean;
  /** Submit the current cart; returns true if the POST succeeded immediately */
  submitOrder: () => Promise<boolean>;
  /** Re-submit a specific recovered order and remove it from IDB on success */
  retryRecoveredOrder: (order: PendingOrder) => Promise<boolean>;
  /** Discard a recovered order (user chose to abandon it) */
  discardRecoveredOrder: (id: number) => Promise<void>;
  /** Refresh the list of pending orders from IDB */
  refreshPendingOrders: () => Promise<void>;
}

export function useOfflineOrders(): UseOfflineOrdersReturn {
  const navigate = useNavigate();
  const { cart } = useStore();

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // Keep a ref to the retry interval so we can clear it
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load pending orders on mount ─────────────────────────────────────────
  const refreshPendingOrders = useCallback(async () => {
    try {
      const orders = await getAllPendingOrders();
      setPendingOrders(orders);
    } catch {
      // IDB unavailable — silently degrade
    }
  }, []);

  useEffect(() => {
    refreshPendingOrders();
  }, [refreshPendingOrders]);

  // ── Auto-retry loop ──────────────────────────────────────────────────────
  const retryAllPending = useCallback(async () => {
    const orders = await getAllPendingOrders();
    if (orders.length === 0) {
      setShowOfflineBanner(false);
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      return;
    }

    for (const order of orders) {
      try {
        await orderService.create({
          tableId: order.tableId ?? undefined,
          items: order.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
          })),
        });
        await deletePendingOrder(order.id!);
        toast.success('Offline order synced successfully!');
      } catch (err) {
        if (!isNetworkError(err)) {
          // Server rejected it (4xx/5xx) — stop retrying this one
          await deletePendingOrder(order.id!);
          toast.error('A saved order was rejected by the server and has been discarded.');
        }
        // If still a network error, leave it in IDB for next cycle
      }
    }

    const remaining = await getAllPendingOrders();
    setPendingOrders(remaining);
    if (remaining.length === 0) {
      setShowOfflineBanner(false);
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      // Navigate to checkout on successful sync of the last order
      navigate('/checkout');
    }
  }, [navigate]);

  // FIX 1 — CODEX-WARN-018: Visibility-aware retry
  // Start / stop the 30 s retry timer based on banner visibility
  useEffect(() => {
    if (showOfflineBanner && !retryTimerRef.current) {
      retryTimerRef.current = setInterval(() => {
        // Skip retry when tab is hidden
        if (document.visibilityState === 'hidden') return;
        retryAllPending();
      }, RETRY_INTERVAL_MS);
    }
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [showOfflineBanner, retryAllPending]);

  // ── navigator.onLine listener → immediate retry ─────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      if (showOfflineBanner) {
        retryAllPending();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [showOfflineBanner, retryAllPending]);

  // ── Submit current cart ──────────────────────────────────────────────────
  const submitOrder = useCallback(async (): Promise<boolean> => {
    try {
      await orderService.create({
        tableId: cart.tableId ?? undefined,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
      });
      return true; // success — caller navigates to checkout
    } catch (err) {
      if (isNetworkError(err)) {
        // Persist to IndexedDB
        await savePendingOrder({
          tableId: cart.tableId,
          items: cart.items.map((i) => ({
            menuItemId: i.menuItemId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal,
          })),
          savedAt: Date.now(),
        });
        setShowOfflineBanner(true);
        await refreshPendingOrders();
        return false;
      }
      // Not a network error — rethrow so the UI can show a normal error toast
      throw err;
    }
  }, [cart.tableId, cart.items, refreshPendingOrders]);

  // ── Recovery helpers (for the modal) ─────────────────────────────────────
  const retryRecoveredOrder = useCallback(
    async (order: PendingOrder): Promise<boolean> => {
      try {
        await orderService.create({
          tableId: order.tableId ?? undefined,
          items: order.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
          })),
        });
        await deletePendingOrder(order.id!);
        await refreshPendingOrders();
        toast.success('Recovered order submitted!');
        return true;
      } catch (err) {
        if (isNetworkError(err)) {
          toast.error('Still offline — will retry automatically.');
          setShowOfflineBanner(true);
          return false;
        }
        await deletePendingOrder(order.id!);
        await refreshPendingOrders();
        toast.error('Order rejected by server and discarded.');
        return false;
      }
    },
    [refreshPendingOrders],
  );

  const discardRecoveredOrder = useCallback(
    async (id: number) => {
      await deletePendingOrder(id);
      await refreshPendingOrders();
      toast('Order discarded', { icon: '🗑️' });
    },
    [refreshPendingOrders],
  );

  return {
    hasPendingOrders: pendingOrders.length > 0,
    pendingOrders,
    showOfflineBanner,
    submitOrder,
    retryRecoveredOrder,
    discardRecoveredOrder,
    refreshPendingOrders,
  };
}
