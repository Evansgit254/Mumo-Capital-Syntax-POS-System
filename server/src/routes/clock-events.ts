import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { Role } from '@mumo/types';

const router = Router();



const createClockEventSchema = z.object({
    userId: z.string().uuid().optional(), // if missing, use req.user.userId
    type: z.enum(['IN', 'OUT'])
});

// All routes require authentication
router.use(authenticate);

// Get recent clock events (admin/manager only)
router.get('/', requireRole(Role.TENANT_ADMIN, Role.MANAGER), async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        
        const clockEvents = await prisma.clockEvent.findMany({
            where: { tenantId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' },
            take: 100 // Limit to recent 100 for speed
        });

        res.json(clockEvents);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching clock events');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a clock event (any authenticated user)
router.post('/', async (req, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const requestingUserId = req.user!.id;
        const requestingRole = req.user!.role as Role;
        
        const data = createClockEventSchema.parse(req.body);
        
        // Determine who we're clocking. 
        // Staff can only clock themselves. Admins/Managers can clock others (e.g. via specific userId)
        let targetUserId = requestingUserId;
        if (data.userId && data.userId !== requestingUserId) {
            if (requestingRole !== Role.TENANT_ADMIN && requestingRole !== Role.MANAGER) {
                return res.status(403).json({ error: 'Only managers can record clock events for others' });
            }
            targetUserId = data.userId;
            
            // Verify target user belongs to tenant
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId }
            });
            if (!targetUser || targetUser.tenantId !== tenantId) {
                return res.status(404).json({ error: 'User not found' });
            }
        }

        const clockEvent = await prisma.clockEvent.create({
            data: {
                tenantId,
                userId: targetUserId,
                type: data.type,
                timestamp: new Date()
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true
                    }
                }
            }
        });

        res.status(201).json(clockEvent);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        logger.error({ err: error }, 'Error creating clock event');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
