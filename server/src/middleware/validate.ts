import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { badRequest } from '../lib/errors';

/**
 * Generic Zod validation middleware factory.
 *
 * Validates `req.body` against the provided schema.
 * On success: replaces req.body with the parsed (typed, coerced) result.
 * On failure: throws AppError(400) with Zod's formatted error messages.
 */
export const validate = (schema: ZodSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
                return next(badRequest(`Validation failed — ${messages}`));
            }
            next(err);
        }
    };
};
