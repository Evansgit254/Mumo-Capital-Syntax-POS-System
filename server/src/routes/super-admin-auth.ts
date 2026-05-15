import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { AppError } from '../lib/errors';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' },
});

const loginSchema = z.object({
  email: z.string().email(),
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
      if (!superAdmin) {
        throw new AppError('Invalid credentials', 401);
      }
      const valid = await bcrypt.compare(
        password, superAdmin.passwordHash
      );
      if (!valid) {
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
        { expiresIn: '8h' }
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
