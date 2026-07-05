import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { getMessageWhere, isSalesRole } from '../middleware/permissions.js';

const router = Router();

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  contactId: z.string().min(1),
  content: z.string().trim().min(1).max(4096),
  messageType: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'TEMPLATE', 'VIDEO', 'AUDIO']).default('TEXT'),
});

const conversationSchema = z.object({
  contactId: z.string().min(1),
  channel: z
    .enum(['WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'GOOGLE_MESSAGES', 'MANUAL'])
    .default('MANUAL'),
});

router.use(requireAuth);

router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.conversation.findMany({
      where: {
        companyId: req.auth!.companyId,
        ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
      },
      include: {
        contact: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

router.post('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contactId, channel } = conversationSchema.parse(req.body);
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, companyId: req.auth!.companyId },
    });

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const data = await prisma.conversation.upsert({
      where: {
        companyId_contactId_channel: {
          companyId: req.auth!.companyId,
          contactId,
          channel,
        },
      },
      create: {
        companyId: req.auth!.companyId,
        contactId,
        channel,
        assignedToId: req.auth!.userId,
        status: 'OPEN',
      },
      update: {
        assignedToId: req.auth!.userId,
        status: 'OPEN',
      },
      include: {
        contact: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

router.get('/conversation/:conversationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.conversationId,
        companyId: req.auth!.companyId,
        ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
      },
      select: { id: true },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const data = await prisma.message.findMany({
      where: { conversationId: conversation.id, ...getMessageWhere(req.auth!) },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

router.post('/send', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = sendMessageSchema.parse(req.body);

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        contactId: payload.contactId,
        companyId: req.auth!.companyId,
        ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
      },
      include: { contact: true },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const data = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          companyId: req.auth!.companyId,
          contactId: payload.contactId,
          conversationId: payload.conversationId,
          senderId: req.auth!.userId,
          direction: 'OUTBOUND',
          channel: conversation.channel,
          messageType: payload.messageType,
          content: payload.content,
          status: 'SENT',
        },
      });

      await tx.conversation.update({
        where: { id: payload.conversationId },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });

      return message;
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

router.post('/send-template', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = sendMessageSchema
      .extend({ templateId: z.string().optional() })
      .parse({ ...req.body, messageType: 'TEMPLATE', content: req.body.content || 'Template message sent' });

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        contactId: payload.contactId,
        companyId: req.auth!.companyId,
        ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
      },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const data = await prisma.message.create({
      data: {
        companyId: req.auth!.companyId,
        contactId: payload.contactId,
        conversationId: payload.conversationId,
        senderId: req.auth!.userId,
        direction: 'OUTBOUND',
        channel: conversation.channel,
        messageType: 'TEMPLATE',
        content: payload.content,
        templateId: payload.templateId,
        status: 'SENT',
      },
    });

    await prisma.conversation.update({
      where: { id: payload.conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to send template message' });
  }
});

export default router;
