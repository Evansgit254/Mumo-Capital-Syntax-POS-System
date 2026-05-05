import { z } from 'zod';
import { AdjustmentType } from '@mumo/types';

export const createInventoryItemSchema = z.object({
    name: z
        .string({ required_error: 'Item name is required' })
        .min(1, 'Name cannot be empty')
        .max(200, 'Name too long'),
    sku: z.string().max(50, 'SKU too long').optional(),
    unit: z
        .string({ required_error: 'Unit is required' })
        .min(1, 'Unit cannot be empty')
        .max(20, 'Unit too long'),
    currentStock: z
        .number({ invalid_type_error: 'Current stock must be a number' })
        .min(0, 'Stock cannot be negative')
        .optional()
        .default(0),
    minStock: z
        .number({ invalid_type_error: 'Min stock must be a number' })
        .min(0, 'Min stock cannot be negative')
        .optional()
        .default(0),
    costPerUnit: z
        .number({ invalid_type_error: 'Cost must be a number' })
        .min(0, 'Cost cannot be negative')
        .optional()
        .default(0),
    supplierId: z.string().max(200).optional(),
});

export const updateInventoryItemSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    sku: z.string().max(50).nullish(),
    unit: z.string().min(1).max(20).optional(),
    currentStock: z.number().min(0).optional(),
    minStock: z.number().min(0).optional(),
    costPerUnit: z.number().min(0).optional(),
    supplierId: z.string().max(200).nullish(),
});

export const adjustInventorySchema = z.object({
    adjustmentType: z.nativeEnum(AdjustmentType, {
        errorMap: () => ({
            message: `Adjustment type must be one of: ${Object.values(AdjustmentType).join(', ')}`,
        }),
    }),
    quantity: z
        .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
        .positive('Quantity must be greater than zero'),
    reason: z
        .string({ required_error: 'Reason is required' })
        .min(1, 'Reason cannot be empty')
        .max(500, 'Reason too long'),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
