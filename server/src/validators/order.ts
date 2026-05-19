import { z } from 'zod';
import { OrderStatus } from '@mumo/types';

const orderItemSchema = z.object({
    menuItemId: z
        .string({ required_error: 'Menu item ID is required' })
        .uuid('Menu item ID must be a valid UUID'),
    quantity: z
        .number({ required_error: 'Quantity is required' })
        .int('Quantity must be an integer')
        .positive('Quantity must be at least 1'),
    notes: z.string().max(200, 'Notes must be 200 characters or fewer').nullish(),
    modifiers: z.array(z.string()).optional(),
});

export const createOrderSchema = z.object({
    tableId: z.string().uuid('Table ID must be a valid UUID').optional(),
    items: z
        .array(orderItemSchema, { required_error: 'Order items are required' })
        .min(1, 'Order must contain at least one item'),
});

export const updateOrderStatusSchema = z.object({
    status: z.nativeEnum(OrderStatus, {
        errorMap: () => ({ message: `Status must be one of: ${Object.values(OrderStatus).join(', ')}` }),
    }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
