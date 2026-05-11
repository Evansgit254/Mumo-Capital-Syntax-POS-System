import { format, isWithinInterval, subDays, startOfDay, endOfDay, differenceInHours } from 'date-fns';

/**
 * PURE Analytics Derivation Functions
 * No hooks, no side effects.
 */

export interface DateRange {
    start: Date;
    end: Date;
}

// ─── REVENUE ─────────────────────────────────────────────────────────────────

export function deriveRevenue(payments: any[], range: DateRange) {
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

    return { totalRevenue, outletData, trendData };
}

// ─── OCCUPANCY ───────────────────────────────────────────────────────────────

export function deriveOccupancy(orders: any[], tables: any[], range: DateRange) {
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

    return { totalCovers, avgTurnTime, heatmap };
}

// ─── MENU PERFORMANCE ────────────────────────────────────────────────────────

export function deriveMenuPerformance(orders: any[], range: DateRange) {
    const periodOrders = orders.filter(o => 
        isWithinInterval(new Date(o.createdAt), { start: startOfDay(range.start), end: endOfDay(range.end) })
    );

    const itemStats: Record<string, { name: string, revenue: number, count: number }> = {};
    
    periodOrders.forEach(o => {
        (o.items || []).forEach((item: any) => {
            const id = item.menuItemId;
            if (!itemStats[id]) {
                itemStats[id] = { name: item.menuItem?.name || 'Unknown', revenue: 0, count: 0 };
            }
            itemStats[id].count += item.quantity;
            itemStats[id].revenue += item.quantity * (item.price || 0);
        });
    });

    const sortedByRevenue = Object.values(itemStats).sort((a, b) => b.revenue - a.revenue);
    const sortedByFreq = Object.values(itemStats).sort((a, b) => b.count - a.count);

    return {
        topRevenue: sortedByRevenue.slice(0, 10),
        topFreq: sortedByFreq.slice(0, 10),
        bottomRevenue: sortedByRevenue.slice(-5).filter(i => i.revenue >= 0)
    };
}

// ─── LABOR EFFICIENCY ────────────────────────────────────────────────────────

export function deriveLaborCost(shifts: any[], users: any[], range: DateRange) {
    const periodShifts = shifts.filter(s => 
        isWithinInterval(new Date(s.startTime), { start: startOfDay(range.start), end: endOfDay(range.end) })
    );

    let totalCost = 0;
    const missingRates: string[] = [];

    periodShifts.forEach(shift => {
        const user = users.find(u => u.id === shift.userId);
        const rate = user?.hourlyRate || 0;
        
        if (!rate || rate === 0) {
            if (user && !missingRates.includes(user.firstName)) missingRates.push(user.firstName);
        }

        const hours = Math.abs(differenceInHours(new Date(shift.endTime), new Date(shift.startTime)));
        totalCost += hours * rate;
    });

    return { totalCost, missingRates };
}

// ─── INVENTORY SNAPSHOT ──────────────────────────────────────────────────────

export function deriveInventoryStats(items: any[]) {
    const totalValue = items.reduce((sum, i) => sum + (i.currentStock * (i.costPerUnit || 0)), 0);
    const alerts = items.filter(i => i.currentStock < i.minStock);
    
    // Mock "days remaining" logic: (current / min) * 7 (weekly baseline)
    const avgDays = items.length > 0 
        ? Math.round(items.reduce((sum, i) => sum + (i.currentStock / (i.minStock || 1)) * 7, 0) / items.length)
        : 0;

    return { totalValue, alertCount: alerts.length, alerts, avgDays };
}
