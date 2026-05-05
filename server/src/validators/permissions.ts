import { z } from 'zod';

export const updatePermissionsSchema = z.object({
    permissions: z
        .array(
            z.string().min(1, 'Permission string cannot be empty').max(100, 'Permission string too long'),
            { required_error: 'Permissions array is required' }
        )
        .max(200, 'Too many permissions'),
});

export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
