import { format, isWithinInterval, subDays, startOfDay, endOfDay, differenceInHours } from 'date-fns';
import type {
    InventoryItem,
    InventorySnapshotData,
    LaborData,
    MenuPerformanceData,
    OccupancyData,
    Order,
    OrderItem,
    Payment,
    RevenueData,
    Shift,
    User
} from '@mumo/types';

/**
 * PURE Analytics Derivation Functions
 * No hooks, no side effects.
 */

export interface DateRange {
    start: Date;
    end: Date;
}

type PaymentWithOrder = Payment & { order?: { station?: string } };
type OrderWithAnalytics = Omit<Order, 'items'> & {
    covers?: number;
    completedAt?: string | Date;
    items?: AnalyticsOrderItem[];
};

type AnalyticsOrderItem = OrderItem & { price?: number; menuItem?: { name?: string } };

interface RevenueSummary {
    totalRevenue: number;
    outletData: { name: string; value: number }[];
    trendData: { name: string; revenue: number }[];
    rawData: RevenueData[];
}

interface OccupancySummary {
    totalCovers: number;
    avgTurnTime: number;
    heatmap: Record<number, Record<number, number>>;
    rawData: OccupancyData[];
}

interface MenuPerformanceSummary {
    topRevenue: MenuPerformanceData[];
    topFreq: MenuPerformanceData[];
    bottomRevenue: MenuPerformanceData[];
}

interface LaborSummary {
    totalCost: number;
    missingRates: string[];
    rawData: LaborData[];
}

interface InventorySummary extends InventorySnapshotData {
    alertCount: number;
    alerts: InventoryItem[];
    avgDays: number;
}

// ─── REVENUE ─────────────────────────────────────────────────────────────────

export function deriveRevenue(payments: PaymentWithOrder[], range: DateRange): RevenueSummary {
    const currentPeriod = payments.filter(p => 
        isWithinInterval(new Date(p.createdAt), { start: startOfDay(range.start), end: endOfDay(range.end) })
    );

    const totalRevenue = currentPeriod.reduce((sum, p) => sum + p.amount, 0);

    // Grouping by outlet type (mock logic based on description, using order.station or similar if available)
    const byOutlet: Record<string, number> = {};
    currentPeriod.forEach(p => {
        const type = p.order?.station || 'General';
        byOutlet[type] = (byOutlet[type] || 0) + p.amount;
    });

    const outletData = Object.entries(byOutlet).map(([name, value]) => ({ name, value }));

    // Daily trend
    const daily: Record<string, number> = {};
    currentPeriod.forEach(p => {
        const day = format(new Date(p.createdAt), 'MMM dd');
        daily[day] = (daily[day] || 0) + p.amount;
    });
    const trendData = Object.entries(daily).map(([name, revenue]) => ({ name, revenue }));

    const rawData = currentPeriod.map(p => ({
        date: format(new Date(p.createdAt), 'yyyy-MM-dd'),
        amount: p.amount,
        outletType: p.order?.station || 'General'
    }));

    return { totalRevenue, outletData, trendData, rawData };
}

// ─── OCCUPANCY ───────────────────────────────────────────────────────────────

export function deriveOccupancy(orders: OrderWithAnalytics[], tables: { id: string }[], range: DateRange): OccupancySummary {
    const periodOrders = orders.filter(o => 
        isWithinInterval(new Date(o.createdAt), { start: startOfDay(range.start), end: endOfDay(range.end) })
    );

    const totalCovers = periodOrders.reduce((sum, o) => sum + (o.covers || 1), 0);
    
    // Avg Turn Time (Duration between first item and completion)
    let totalMinutes = 0;
    let turnCount = 0;
    periodOrders.forEach(o => {
        if (o.completedAt) {
            const minutes = (new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
            totalMinutes += minutes;
            turnCount++;
        }
    });
    const avgTurnTime = turnCount > 0 ? Math.round(totalMinutes / turnCount) : 0;

    // Heatmap: [Hour][DayOfWeek]
    const heatmap: Record<number, Record<number, number>> = {};
    periodOrders.forEach(o => {
        const date = new Date(o.createdAt);
        const hour = date.getHours();
        const day = date.getDay();
        if (!heatmap[hour]) heatmap[hour] = {};
        heatmap[hour][day] = (heatmap[hour][day] || 0) + 1;
    });

    const rawData = periodOrders.map(o => ({
        hour: new Date(o.createdAt).getHours(),
        day: format(new Date(o.createdAt), 'EEE'),
        rate: tables.length > 0 ? (o.covers || 1) / tables.length : 0
    }));

    return { totalCovers, avgTurnTime, heatmap, rawData };
}

// ─── MENU PERFORMANCE ────────────────────────────────────────────────────────

export function deriveMenuPerformance(orders: OrderWithAnalytics[], range: DateRange): MenuPerformanceSummary {
    const periodOrders = orders.filter(o => 
        isWithinInterval(new Date(o.createdAt), { start: startOfDay(range.start), end: endOfDay(range.end) })
    );

    const itemStats: Record<string, MenuPerformanceData> = {};
    
    periodOrders.forEach(o => {
        (o.items || []).forEach((item) => {
            const id = item.menuItemId;
            if (!itemStats[id]) {
                itemStats[id] = { itemId: id, name: item.menuItem?.name || 'Unknown', revenue: 0, orderCount: 0 };
            }
            itemStats[id].orderCount += item.quantity;
            itemStats[id].revenue += item.quantity * (item.price || 0);
        });
    });

    const sortedByRevenue = Object.values(itemStats).sort((a, b) => b.revenue - a.revenue);
    const sortedByFreq = Object.values(itemStats).sort((a, b) => b.orderCount - a.orderCount);

    return {
        topRevenue: sortedByRevenue.slice(0, 10),
        topFreq: sortedByFreq.slice(0, 10),
        bottomRevenue: sortedByRevenue.slice(-5).filter(i => i.revenue >= 0)
    };
}

// ─── LABOR EFFICIENCY ────────────────────────────────────────────────────────

export function deriveLaborCost(shifts: Shift[], users: User[], range: DateRange): LaborSummary {
    const periodShifts = shifts.filter(s => 
        isWithinInterval(new Date(s.startTime), { start: startOfDay(range.start), end: endOfDay(range.end) })
    );

    let totalCost = 0;
    const missingRates: string[] = [];
    const rawData: LaborData[] = [];

    periodShifts.forEach(shift => {
        const user = users.find(u => u.id === shift.userId);
        const rate = user?.hourlyRate || 0;
        
        if (!rate || rate === 0) {
            if (user && !missingRates.includes(user.firstName)) missingRates.push(user.firstName);
        }

        const hours = Math.abs(differenceInHours(new Date(shift.endTime), new Date(shift.startTime)));
        totalCost += hours * rate;
        rawData.push({
            userId: shift.userId,
            name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            scheduledHours: hours,
            hourlyRate: rate,
            totalCost: hours * rate
        });
    });

    return { totalCost, missingRates, rawData };
}

// ─── INVENTORY SNAPSHOT ──────────────────────────────────────────────────────

export function deriveInventoryStats(items: InventoryItem[]): InventorySummary {
    const totalValue = items.reduce((sum, i) => sum + (i.currentStock * (i.costPerUnit || 0)), 0);
    const alerts = items.filter(i => i.currentStock < i.minStock);
    
    // Mock "days remaining" logic: (current / min) * 7 (weekly baseline)
    const avgDays = items.length > 0 
        ? Math.round(items.reduce((sum, i) => sum + (i.currentStock / (i.minStock || 1)) * 7, 0) / items.length)
        : 0;

    return {
        totalValue,
        itemsBelowThreshold: alerts.length,
        averageDaysRemaining: avgDays,
        alertCount: alerts.length,
        alerts,
        avgDays
    };
}
