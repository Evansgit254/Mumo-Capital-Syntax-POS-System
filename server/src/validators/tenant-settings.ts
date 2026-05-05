import { z } from 'zod';

export const updateTenantSettingsSchema = z.object({
    currency: z
        .string()
        .min(1, 'Currency cannot be empty')
        .max(10, 'Currency code too long')
        .optional(),
    taxRate: z
        .number({ invalid_type_error: 'Tax rate must be a number' })
        .min(0, 'Tax rate cannot be negative')
        .max(100, 'Tax rate cannot exceed 100%')
        .optional(),
    logoUrl: z.string().url('Must be a valid URL').nullish(),
    timezone: z
        .string()
        .min(1, 'Timezone cannot be empty')
        .max(50, 'Timezone too long')
        .optional(),
});

export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>;
