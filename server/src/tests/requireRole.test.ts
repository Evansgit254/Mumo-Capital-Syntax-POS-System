import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/requireRole';
import { AppError } from '../lib/errors';
import { Role } from '@mumo/types';

function createMockReqRes(user?: any) {
    const req = { user } as Request;
    const res = {} as Response;
    return { req, res };
}

describe('requireRole middleware', () => {
    let nextFn: NextFunction & ReturnType<typeof vi.fn>;

    beforeEach(() => {
        nextFn = vi.fn();
    });

    it('should call next() when user has an allowed role', () => {
        const middleware = requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN);

        const { req, res } = createMockReqRes({
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: Role.SUPER_ADMIN,
        });

        middleware(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        expect(nextFn).toHaveBeenCalledWith(); // no error
    });

    it('should call next() for second allowed role in list', () => {
        const middleware = requireRole(Role.MANAGER, Role.STAFF);

        const { req, res } = createMockReqRes({
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: Role.STAFF,
        });

        middleware(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        expect(nextFn).toHaveBeenCalledWith();
    });

    it('should pass 403 AppError when user role is not in allowed list', () => {
        const middleware = requireRole(Role.SUPER_ADMIN, Role.TENANT_ADMIN);

        const { req, res } = createMockReqRes({
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: Role.STAFF,
        });

        middleware(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('STAFF');
        expect(err.message).toContain('SUPER_ADMIN');
    });

    it('should pass 401 AppError when req.user is undefined (auth not run)', () => {
        const middleware = requireRole(Role.STAFF);

        const { req, res } = createMockReqRes(undefined);

        middleware(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(401);
    });

    it('should work with a single required role', () => {
        const middleware = requireRole(Role.MANAGER);

        const { req, res } = createMockReqRes({
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: Role.MANAGER,
        });

        middleware(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        expect(nextFn).toHaveBeenCalledWith();
    });

    it('should reject when role does not match single required role', () => {
        const middleware = requireRole(Role.MANAGER);

        const { req, res } = createMockReqRes({
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: Role.STAFF,
        });

        middleware(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(403);
    });
});
