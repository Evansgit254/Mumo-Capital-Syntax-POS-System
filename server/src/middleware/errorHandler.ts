import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

/**
 * Centralized error handling middleware.
 *
 * Rules:
 * - AppError (isOperational=true): return error message and status code
 * - In production: NEVER leak stack traces or internal details
 * - In development: include stack trace for debugging
 * - Handles Prisma known errors (unique constraint, not found)
 * - Catches all unknown errors as 500
 */
export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    const isDev = process.env.NODE_ENV !== 'production';

    // ── Known operational error ────────────────────────────────────────────────
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            ...(isDev && { stack: err.stack }),
        });
    }

    // ── Prisma known request errors ────────────────────────────────────────────
    if (err.constructor?.name === 'PrismaClientKnownRequestError') {
        const prismaErr = err as any;
        if (prismaErr.code === 'P2002') {
            return res.status(409).json({
                error: `Unique constraint violation on: ${prismaErr.meta?.target?.join(', ') || 'unknown field'}`,
            });
        }
        if (prismaErr.code === 'P2025') {
            return res.status(404).json({
                error: 'Record not found',
            });
        }
    }

    // ── Prisma validation errors ───────────────────────────────────────────────
    if (err.constructor?.name === 'PrismaClientValidationError') {
        return res.status(400).json({
            error: 'Invalid data sent to the database',
            ...(isDev && { detail: err.message }),
        });
    }

    // ── SyntaxError from malformed JSON body ───────────────────────────────────
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({
            error: 'Malformed JSON in request body',
        });
    }

    // ── Unknown / unexpected error ─────────────────────────────────────────────
    console.error('[FATAL] Unhandled error:', err);

    res.status(500).json({
        error: isDev ? err.message : 'Internal server error',
        ...(isDev && { stack: err.stack }),
    });
};
