/**
 * Typed application error class.
 * `isOperational` distinguishes expected client errors from unexpected crashes.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

// ── Factory helpers ──────────────────────────────────────────────────────────

export const badRequest = (message = 'Bad request') =>
    new AppError(message, 400);

export const unauthorized = (message = 'Unauthorized') =>
    new AppError(message, 401);

export const forbidden = (message = 'Forbidden') =>
    new AppError(message, 403);

export const notFound = (message = 'Resource not found') =>
    new AppError(message, 404);

export const conflict = (message = 'Conflict') =>
    new AppError(message, 409);
