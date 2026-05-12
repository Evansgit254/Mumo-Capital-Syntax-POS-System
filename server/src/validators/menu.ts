import { z } from 'zod';

export const createMenuItemSchema = z.object({
    name: z
        .string({ required_error: 'Menu item name is required' })
        .min(1, 'Name cannot be empty')
        .max(200, 'Name too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    price: z
        .number({ required_error: 'Price is required', invalid_type_error: 'Price must be a number' })
        .positive('Price must be greater than zero'),
    categoryId: z.string().min(1, 'Category is required').optional(),
    isAvailable: z.boolean().optional().default(true),
});

export const updateMenuItemSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    price: z.number().positive('Price must be greater than zero').optional(),
    categoryId: z.string().nullish(),
    isAvailable: z.boolean().optional(),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
