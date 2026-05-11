import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { Role } from '@mumo/types';

// Mock environment
vi.stubEnv('JWT_SECRET', 'test-secret');

function createMockReqRes(overrides: Partial<Request> = {}) {
    const req = {
        headers: {},
        ...overrides,
    } as Request;
    const res = {} as Response;
    return { req, res };
}

describe('authenticate middleware', () => {
    let nextFn: NextFunction & ReturnType<typeof vi.fn>;

    beforeEach(() => {
        nextFn = vi.fn();
    });

    it('should call next() with no error for a valid token and matching x-tenant-id', () => {
        const tenantId = 'tenant-123';
        const token = jwt.sign(
            { userId: 'user-1', tenantId, role: Role.STAFF },
            'test-secret',
            { expiresIn: '15m' }
        );

        const { req, res } = createMockReqRes({
            headers: {
                authorization: `Bearer ${token}`,
                'x-tenant-id': tenantId,
            } as any,
        });

        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        expect(nextFn).toHaveBeenCalledWith(); // no error arg
        expect(req.user).toBeDefined();
        expect(req.user!.id).toBe('user-1');
        expect(req.user!.tenantId).toBe(tenantId);
        expect(req.user!.role).toBe(Role.STAFF);
    });

    it('should pass 401 AppError when Authorization header is missing', () => {
        const { req, res } = createMockReqRes({ headers: {} as any });

        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(401);
    });

    it('should pass 401 AppError when Authorization header is malformed', () => {
        const { req, res } = createMockReqRes({
            headers: { authorization: 'NotBearer xyz' } as any,
        });

        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(401);
    });

    it('should pass 401 AppError for an expired token', () => {
        const token = jwt.sign(
            { userId: 'user-1', tenantId: 'tenant-1', role: Role.STAFF },
            'test-secret',
            { expiresIn: '0s' } // already expired
        );

        const { req, res } = createMockReqRes({
            headers: {
                authorization: `Bearer ${token}`,
                'x-tenant-id': 'tenant-1',
            } as any,
        });

        // Small delay to ensure expiry
        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(401);
    });

    it('should pass 401 AppError for a token signed with wrong secret', () => {
        const token = jwt.sign(
            { userId: 'user-1', tenantId: 'tenant-1', role: Role.STAFF },
            'wrong-secret',
            { expiresIn: '15m' }
        );

        const { req, res } = createMockReqRes({
            headers: {
                authorization: `Bearer ${token}`,
                'x-tenant-id': 'tenant-1',
            } as any,
        });

        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(401);
    });

    it('should pass 403 AppError when x-tenant-id header is missing', () => {
        const token = jwt.sign(
            { userId: 'user-1', tenantId: 'tenant-1', role: Role.STAFF },
            'test-secret',
            { expiresIn: '15m' }
        );

        const { req, res } = createMockReqRes({
            headers: { authorization: `Bearer ${token}` } as any,
        });

        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('x-tenant-id');
    });

    it('should pass 403 AppError when x-tenant-id does not match JWT tenantId', () => {
        const token = jwt.sign(
            { userId: 'user-1', tenantId: 'tenant-AAA', role: Role.STAFF },
            'test-secret',
            { expiresIn: '15m' }
        );

        const { req, res } = createMockReqRes({
            headers: {
                authorization: `Bearer ${token}`,
                'x-tenant-id': 'tenant-BBB',
            } as any,
        });

        authenticate(req, res, nextFn);

        expect(nextFn).toHaveBeenCalledTimes(1);
        const err = nextFn.mock.calls[0][0] as AppError;
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('mismatch');
    });
});
