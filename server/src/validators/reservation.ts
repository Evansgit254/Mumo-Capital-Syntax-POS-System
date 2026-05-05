import { z } from 'zod';
import { ReservationStatus } from '@mumo/types';

export const createReservationSchema = z.object({
    tableId: z.string().uuid('Table ID must be a valid UUID').optional(),
    guestName: z
        .string({ required_error: 'Guest name is required' })
        .min(1, 'Guest name cannot be empty')
        .max(200, 'Guest name too long'),
    guestPhone: z.string().max(30, 'Phone number too long').optional(),
    guestEmail: z.string().email('Must be a valid email').optional(),
    guestCount: z
        .number({ required_error: 'Guest count is required', invalid_type_error: 'Guest count must be a number' })
        .int('Guest count must be an integer')
        .min(1, 'Guest count must be at least 1')
        .max(100, 'Guest count too large'),
    startTime: z
        .string({ required_error: 'Start time is required' })
        .datetime({ message: 'Start time must be a valid ISO 8601 datetime' }),
    endTime: z
        .string()
        .datetime({ message: 'End time must be a valid ISO 8601 datetime' })
        .optional(),
    notes: z.string().max(1000, 'Notes too long').optional(),
});

export const updateReservationSchema = z.object({
    tableId: z.string().uuid('Table ID must be a valid UUID').nullish(),
    guestName: z.string().min(1).max(200).optional(),
    guestPhone: z.string().max(30).nullish(),
    guestEmail: z.string().email().nullish(),
    guestCount: z.number().int().min(1).max(100).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().nullish(),
    status: z.nativeEnum(ReservationStatus, {
        errorMap: () => ({ message: `Status must be one of: ${Object.values(ReservationStatus).join(', ')}` }),
    }).optional(),
    notes: z.string().max(1000).nullish(),
});

export const checkinReservationSchema = z.object({
    arrivalTime: z
        .string()
        .datetime({ message: 'Arrival time must be a valid ISO 8601 datetime' })
        .optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type CheckinReservationInput = z.infer<typeof checkinReservationSchema>;
