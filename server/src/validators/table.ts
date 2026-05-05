import { z } from 'zod';

export const createTableSchema = z.object({
    number: z
        .string({ required_error: 'Table number is required' })
        .min(1, 'Table number cannot be empty')
        .max(20, 'Table number too long'),
    capacity: z
        .number({ required_error: 'Capacity is required', invalid_type_error: 'Capacity must be a number' })
        .int('Capacity must be an integer')
        .positive('Capacity must be at least 1'),
});

export const updateTableSchema = z.object({
    number: z.string().min(1).max(20).optional(),
    capacity: z.number().int().positive().optional(),
    isOccupied: z.boolean().optional(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
