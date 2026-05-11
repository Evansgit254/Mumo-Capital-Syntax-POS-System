import { z } from 'zod';

export const createVendorSchema = z.object({
    name: z.string().min(1, 'Vendor name is required'),
    contactName: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    categories: z.array(z.string()).optional().default([]),
});

export const updateVendorSchema = createVendorSchema.partial();

export const createPurchaseOrderSchema = z.object({
    vendorId: z.string().uuid('Invalid vendor ID'),
    items: z.array(z.object({
        inventoryItemId: z.string().uuid('Invalid inventory item ID'),
        orderedQty: z.number().positive('Quantity must be positive'),
        unitCost: z.number().min(0, 'Unit cost cannot be negative'),
    })).min(1, 'At least one item is required'),
});

export const updatePOStatusSchema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'RECEIVED']),
    receivedItems: z.array(z.object({
        inventoryItemId: z.string().uuid(),
        receivedQty: z.number().nonnegative(),
        reason: z.string().optional()
    })).optional(),
});
