import { z } from 'zod';

export const createCustomerSchema = z.object({
    name: z
        .string({ required_error: 'Customer name is required' })
        .min(1, 'Name cannot be empty')
        .max(200, 'Name too long'),
    email: z.string().email('Must be a valid email').optional(),
    phone: z.string().max(30, 'Phone number too long').optional(),
}).refine(
    (data) => data.email || data.phone,
    { message: 'At least one contact method (email or phone) is required' }
);

export const updateCustomerSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().nullish(),
    phone: z.string().max(30).nullish(),
    loyaltyPoints: z.number().int().min(0, 'Loyalty points cannot be negative').optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
