import { z } from 'zod';
import { Role } from '@mumo/types';

export const loginSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .email('Must be a valid email address'),
    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password cannot be empty'),
});

export const registerSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .email('Must be a valid email address'),
    password: z
        .string({ required_error: 'Password is required' })
        .min(8, 'Password must be at least 8 characters'),
    firstName: z
        .string({ required_error: 'First name is required' })
        .min(1, 'First name cannot be empty')
        .max(100, 'First name too long'),
    lastName: z
        .string({ required_error: 'Last name is required' })
        .min(1, 'Last name cannot be empty')
        .max(100, 'Last name too long'),
    tenantId: z
        .string({ required_error: 'Tenant ID is required' })
        .uuid('Tenant ID must be a valid UUID'),
    role: z
        .nativeEnum(Role, { errorMap: () => ({ message: `Role must be one of: ${Object.values(Role).join(', ')}` }) })
        .optional()
        .default(Role.STAFF),
});

export const refreshSchema = z.object({
    refreshToken: z
        .string({ required_error: 'Refresh token is required' })
        .min(1, 'Refresh token cannot be empty'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
