import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

const route = readFileSync('src/routes/internal.routes.ts', 'utf8');
const service = readFileSync('src/services/internalLeadIntake.service.ts', 'utf8');
const app = readFileSync('src/app.ts', 'utf8');

describe('internal lead intake wiring', () => {
  it('mounts the route without a duplicate api prefix', () => {
    expect(app).toContain("app.use('/api/internal', internalRoutes)");
    expect(app).not.toContain('/api/api/internal/leads');
  });

  it('requires a bearer integration secret', () => {
    expect(route).toContain('CODE2CREST_LEADFLOW_INTEGRATION_SECRET');
    expect(route).toContain('timingSafeEqual');
    expect(route).toContain('res.status(401)');
  });

  it('resolves the configured Code2Crest tenant server-side', () => {
    expect(service).toContain('CODE2CREST_LEADFLOW_COMPANY_ID');
    expect(service).toContain('prisma.company.findUnique');
    expect(service).not.toContain('companyId: payload');
  });

  it('scopes contact/deal lookup and duplicate suppression by company', () => {
    expect(service).toContain('companyId: company.id');
    expect(service).toContain('createdAt: { gte: duplicateWindowStart }');
    expect(service).toContain('source: LEAD_SOURCES.CODE2CREST_GET_QUOTE');
    expect(service).toContain('stage: { in: [...OPEN_DEAL_STAGES] }');
  });

  it('logs website lead activity with safe metadata', () => {
    expect(service).toContain('WEBSITE_LEAD_CAPTURED');
    expect(service).toContain('utmSource');
    expect(service).toContain('utmCampaign');
    expect(service).not.toContain('projectDescription: payload.projectDescription');
  });
});
