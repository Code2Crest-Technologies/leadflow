import 'dotenv/config';
import { ensureCode2CrestClientOnboardingTemplate } from '../services/clientOnboarding.service.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

async function main() {
  const template = await ensureCode2CrestClientOnboardingTemplate();
  logger.info({
    event: 'CODE2CREST_CLIENT_ONBOARDING_TEMPLATE_READY',
    formId: template.id,
    companyId: template.companyId,
    fieldCount: template.fields.length,
  });
}

main()
  .catch((error) => {
    logger.error({ error }, 'Failed to ensure Code2Crest client onboarding template');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
