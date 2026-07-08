// src/app.ts

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { captureRawBody } from './middleware/validation.js';
import { createRateLimiter, securityHeaders } from './middleware/security.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import contactRoutes from './routes/contacts.routes.js';
import contactGroupRoutes from './routes/contact-groups.routes.js';
import messageRoutes from './routes/messages.routes.js';
import conversationRoutes from './routes/conversations.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import dealsRoutes from './routes/deals.routes.js';
import noteRoutes from './routes/note.routes.js';
import taskRoutes from './routes/tasks.routes.js';
import quotationRoutes from './routes/quotations.routes.js';
import invoiceRoutes from './routes/invoices.routes.js';
import exportRoutes from './routes/export.routes.js';
import userRoutes from './routes/users.routes.js';
import companyRoutes from './routes/company.routes.js';
import integrationRoutes from './routes/integrations.routes.js';

const app: Express = express();
const uploadLimit = process.env.UPLOAD_MAX_BODY_SIZE || '10mb';
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ============ MIDDLEWARE ============

// Capture raw body for webhook signature validation (MUST be before JSON parsing)
app.use(captureRawBody);
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: uploadLimit }));
app.use(express.urlencoded({ limit: uploadLimit, extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  dotfiles: 'deny',
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// ============ ROUTES ============

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Lead Flow API',
    version: '1.0.0',
    docs: '/api',
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'WhatsApp Business CRM API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      contacts: '/api/contacts',
      contactGroups: '/api/contact-groups',
      messages: '/api/messages',
      conversations: '/api/conversations',
      dashboard: '/api/dashboard',
      analytics: '/api/analytics',
      deals: '/api/deals',
      tasks: '/api/tasks',
      quotations: '/api/quotations',
      invoices: '/api/invoices',
      exports: '/api/export',
      users: '/api/users',
      company: '/api/company',
      integrations: '/api/integrations',
      notes: '/api/notes',
      webhook: '/api/webhook',
    },
  });
});

// Mount API routes
app.use('/api/auth', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/contact-groups', contactGroupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/notes', noteRoutes);

// ============ ERROR HANDLING ============

// 404 handler - must be before global error handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler - must have 4 parameters
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
