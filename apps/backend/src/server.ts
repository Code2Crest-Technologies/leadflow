// src/server.ts

import app from "./app.js";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from "./utils/logger.js";
import { testDatabaseConnection } from './config/database.js';

const PORT = process.env.PORT || 3001;
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    const httpServer = createServer(app);
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      logger.info({ socketId: socket.id }, 'WebSocket connected');

      socket.on('join:company', (companyId: string) => {
        socket.join(`company:${companyId}`);
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'WebSocket disconnected');
      });
    });

    app.set('io', io);

    // Start HTTP and WebSocket server
    const server = httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
