// src/utils/logger.ts

import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  level: process.env.LOG_LEVEL || 'info',
});
