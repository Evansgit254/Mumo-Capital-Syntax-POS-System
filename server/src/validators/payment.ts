import { z } from 'zod';
import { PaymentStatus } from '@mumo/types';

export const createPaymentSchema = z.object({
    orderId: z
        .string({ required_error: 'Order ID is required' })
        .uuid('Order ID must be a valid UUID'),
    amount: z
        .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
        .positive('Amount must be greater than zero'),
    method: z
        .string({ required_error: 'Payment method is required' })
        .min(1, 'Payment method cannot be empty')
        .max(50, 'Payment method too long'),
});

export const updatePaymentStatusSchema = z.object({
    status: z.nativeEnum(PaymentStatus, {
        errorMap: () => ({
            message: `Status must be one of: ${Object.values(PaymentStatus).join(', ')}`,
        }),
    }),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;
