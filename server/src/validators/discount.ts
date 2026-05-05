import { z } from 'zod';

export const redeemDiscountSchema = z.object({
    orderId: z
        .string({ required_error: 'Order ID is required' })
        .uuid('Order ID must be a valid UUID'),
    code: z
        .string({ required_error: 'Discount code is required' })
        .min(1, 'Discount code cannot be empty')
        .max(50, 'Discount code too long')
        .transform((val) => val.toUpperCase().trim()),
});

export type RedeemDiscountInput = z.infer<typeof redeemDiscountSchema>;
