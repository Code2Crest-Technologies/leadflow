import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';

describe('Phase 7 project kickoff foundation', () => {
  it('adds project kickoff models through a production migration', () => {
    const migration = readFileSync('prisma/migrations/20260731090000_phase_7_project_kickoff/migration.sql', 'utf8');

    expect(migration).toContain('CREATE TYPE "ProjectStatus"');
    expect(migration).toContain('CREATE TABLE "Project"');
    expect(migration).toContain('CREATE TABLE "ProjectMember"');
    expect(migration).toContain('CREATE TABLE "ProjectMilestone"');
    expect(migration).toContain('CREATE TABLE "ProjectDeliverable"');
    expect(migration).toContain('CREATE TABLE "ProjectRequirement"');
    expect(migration).toContain('CREATE UNIQUE INDEX "Project_dealId_key"');
    expect(migration).toContain('ALTER TABLE "Task" ADD COLUMN "projectId"');
    expect(migration).toContain('ALTER TABLE "ActivityLog" ADD COLUMN "projectId"');
  });

  it('declares project activity events for timeline/audit visibility', () => {
    expect(ACTIVITY_TYPES.PROJECT_CREATED).toBe('PROJECT_CREATED');
    expect(ACTIVITY_TYPES.PROJECT_KICKOFF_READINESS_OVERRIDE).toBe('PROJECT_KICKOFF_READINESS_OVERRIDE');
    expect(ACTIVITY_TYPES.PROJECT_MANAGER_ASSIGNED).toBe('PROJECT_MANAGER_ASSIGNED');
    expect(ACTIVITY_TYPES.PROJECT_TEAM_MEMBER_ADDED).toBe('PROJECT_TEAM_MEMBER_ADDED');
    expect(ACTIVITY_TYPES.PROJECT_STARTED).toBe('PROJECT_STARTED');
    expect(ACTIVITY_TYPES.PROJECT_KICKOFF_EMAIL_SENT).toBe('PROJECT_KICKOFF_EMAIL_SENT');
  });

  it('exposes project kickoff APIs without replacing existing deal/onboarding routes', () => {
    const app = readFileSync('src/app.ts', 'utf8');
    const routes = readFileSync('src/routes/projects.routes.ts', 'utf8');
    const dealRoutes = readFileSync('src/routes/deals.routes.ts', 'utf8');

    expect(app).toContain("app.use('/api/projects', projectRoutes)");
    expect(routes).toContain("router.get('/deals/:dealId/readiness'");
    expect(routes).toContain("router.post('/deals/:dealId'");
    expect(routes).toContain("router.patch('/:id/status'");
    expect(dealRoutes).toContain("router.post('/:id/onboarding/start'");
  });

  it('keeps Phase 7 as handoff/kickoff instead of a full PM replacement', () => {
    const service = readFileSync('src/services/projectKickoff.service.ts', 'utf8');

    expect(service).toContain('getKickoffReadiness');
    expect(service).toContain('createProjectFromDeal');
    expect(service).toContain('createProjectHandoffPayload');
    expect(service).toContain('Deal must be moved to WON');
    expect(service).toContain('Client onboarding must be completed before kickoff');
    expect(service).toContain('Do not store passwords');
    expect(service).toContain('Generated during project kickoff preparation');
  });
});
