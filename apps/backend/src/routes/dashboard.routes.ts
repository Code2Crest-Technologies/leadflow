import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { getMessageWhere, getTaskWhere } from '../middleware/permissions.js';
import { getAnalyticsData } from '../services/analytics.service.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyId = req.auth!.companyId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const upcomingEnd = new Date(startOfDay);
    upcomingEnd.setDate(upcomingEnd.getDate() + 7);

    const [
      contacts,
      conversations,
      messagesToday,
      todayTasks,
      overdueTasks,
      upcomingTasks,
      recentActivity,
      recentMessages,
      analytics,
    ] =
      await Promise.all([
        prisma.contact.count({ where: { companyId } }),
        prisma.conversation.count({ where: { companyId, status: 'OPEN' } }),
        prisma.message.count({
          where: { ...getMessageWhere(req.auth!), createdAt: { gte: startOfDay, lt: endOfDay } },
        }),
        prisma.task.count({
          where: { ...getTaskWhere(req.auth!), status: 'PENDING', dueDate: { gte: startOfDay, lt: endOfDay } },
        }),
        prisma.task.count({
          where: { ...getTaskWhere(req.auth!), status: 'PENDING', dueDate: { lt: startOfDay } },
        }),
        prisma.task.count({
          where: { ...getTaskWhere(req.auth!), status: 'PENDING', dueDate: { gte: endOfDay, lt: upcomingEnd } },
        }),
        prisma.activityLog.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
            deal: { select: { title: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.message.findMany({
          where: getMessageWhere(req.auth!),
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            content: true,
            direction: true,
            status: true,
            createdAt: true,
            contact: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        }),
        getAnalyticsData(req.auth!),
      ]);

    res.json({
      success: true,
      data: {
        contacts,
        conversations,
        openDeals: analytics.summary.openDeals,
        pipelineValue: analytics.summary.pipelineValue,
        wonRevenue: analytics.summary.wonRevenue,
        wonDeals: analytics.summary.wonDeals,
        lostDeals: analytics.summary.lostDeals,
        messagesToday,
        todayTasks,
        overdueTasks,
        upcomingTasks,
        recentActivity,
        recentMessages,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

export default router;
