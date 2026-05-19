import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { AppError } from '../lib/errors';

const router = Router();

// FIX 6 — CODEX-CRIT-006 / CODEX-WARN-005: Timing attack prevention
const DUMMY_HASH = '$2b$12$LJ3m4ys3Lzwpzen.Dv0eOe1JEaVPq3B3qUBfVVqFmxJ1kGpQvS6.e';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' },
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { email },
      });

      // FIX 6: Always compare — even if superAdmin not found
      const passwordToCompare = superAdmin?.passwordHash ?? DUMMY_HASH;
      const valid = await bcrypt.compare(password, passwordToCompare);

      if (!superAdmin || !valid) {
        throw new AppError('Invalid credentials', 401);
      }

      const secret = process.env.SUPER_ADMIN_JWT_SECRET;
      if (!secret) {
        throw new Error('SUPER_ADMIN_JWT_SECRET not set');
      }

      const token = jwt.sign(
        { id: superAdmin.id, email: superAdmin.email,
          role: 'SUPER_ADMIN' },
        secret,
        { algorithm: 'HS256', expiresIn: '8h' }
      );

      res.json({
        token,
        superAdmin: {
          id: superAdmin.id,
          email: superAdmin.email,
          name: superAdmin.name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
