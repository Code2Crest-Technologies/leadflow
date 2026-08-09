import 'dotenv/config';

import { prisma } from '../config/database.js';
import { processClientOnboardingRemindersForCompany } from '../services/clientOnboarding.service.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableDatabaseError(error: unknown) {
  const candidate = error as { name?: string; code?: string } | undefined;

  return (
    candidate?.name === 'PrismaClientInitializationError' ||
    candidate?.code === 'P1001' ||
    candidate?.code === 'P2024' ||
    candidate?.code === 'P2028'
  );
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await processClientOnboardingRemindersForCompany();
      logger.info({ event: 'CLIENT_ONBOARDING_REMINDER_CRON_COMPLETE', result }, 'Client onboarding reminder cron completed');
      return;
    } catch (error) {
      const shouldRetry = isRetryableDatabaseError(error) && attempt < MAX_ATTEMPTS;

      logger.error(
        {
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          retrying: shouldRetry,
          error,
        },
        'Client onboarding reminder cron attempt failed'
      );

      if (!shouldRetry) {
        throw error;
      }

      await sleep(RETRY_DELAY_MS);
    }
  }
}

main()
  .catch((error) => {
    logger.error(
      {
        error,
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      },
      'Client onboarding reminder cron failed. Verify DATABASE_URL connectivity and Neon/Railway network access.'
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
