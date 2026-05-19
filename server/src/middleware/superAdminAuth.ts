import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

interface SuperAdminPayload {
  id: string;
  email: string;
  role: 'SUPER_ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      superAdmin?: SuperAdminPayload;
    }
  }
}

export function superAdminAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Super admin token required', 401));
  }

  const token = authHeader.slice(7);
  const secret = process.env.SUPER_ADMIN_JWT_SECRET;
  if (!secret) throw new Error('SUPER_ADMIN_JWT_SECRET not set');

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as SuperAdminPayload;
    if (payload.role !== 'SUPER_ADMIN') {
      return next(new AppError('Unauthorized', 403));
    }
    req.superAdmin = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired super admin token', 401));
  }
}
